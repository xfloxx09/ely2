import { createServer } from "http";
import { Server } from "socket.io";
import { eq } from "drizzle-orm";
import {
  getDb,
  users,
  communicationProfiles,
  userApiKeys,
  elyCredits,
} from "@ely/db";
import { getNeutralProfile } from "@ely/personality";
import {
  buildSystemPrompt,
  streamElyCore,
  detectModuleIntent,
  parseNexusCommand,
  extractMemories,
  moduleHandlers,
  decryptApiKey,
  streamNexusModel,
} from "@ely/ai";
import {
  getOrCreateConversation,
  saveMessage,
  getConversationMessages,
  getUserMemories,
  saveMemory,
  logTaskExecution,
  recordChatActivity,
} from "@ely/chat";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const port = parseInt(process.env.PORT || "3002");

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join", async ({ userId }: { userId: string }) => {
    socket.data.userId = userId;
    const conv = await getOrCreateConversation(userId);
    socket.data.conversationId = conv.id;
    socket.join(conv.id);

    const msgs = await getConversationMessages(conv.id);
    socket.emit("history", msgs);
  });

  socket.on("message", async ({ content }: { content: string }) => {
    const userId = socket.data.userId as string;
    const conversationId = socket.data.conversationId as string;
    if (!userId || !conversationId) return;

    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return;

    if (user.tier === "FREE") {
      const today = new Date().toISOString().slice(0, 10);
      const key = `msg_limit:${userId}:${today}`;
      // Simple in-memory fallback if no Redis in WS
      socket.emit("avatar_state", { state: "listening" });
    }

    await saveMessage(conversationId, "USER", content);
    socket.emit("avatar_state", { state: "thinking" });

    const nexusCmd = parseNexusCommand(content);
    const [commProfile] = await db
      .select()
      .from(communicationProfiles)
      .where(eq(communicationProfiles.userId, userId))
      .limit(1);
    const profile = commProfile
      ? { styleSummary: commProfile.styleSummary, systemPromptAddendum: commProfile.systemPromptAddendum, preferences: commProfile.preferences as Record<string, unknown> }
      : getNeutralProfile();
    const userMemories = await getUserMemories(userId, 5);
    const memoryTexts = userMemories.map((m) => m.content);

    let fullResponse = "";
    let modelUsed = "gpt-4o-mini";

    if (nexusCmd && (user.tier === "PLUS" || user.tier === "PRO")) {
      const [apiKeyRow] = await db
        .select()
        .from(userApiKeys)
        .where(eq(userApiKeys.userId, userId))
        .limit(1);

      let apiKey: string | undefined;
      if (apiKeyRow) {
        apiKey = decryptApiKey(apiKeyRow.encryptedKey);
      } else if (user.tier === "PLUS") {
        const [credits] = await db.select().from(elyCredits).where(eq(elyCredits.userId, userId)).limit(1);
        if (!credits || credits.balance <= 0) {
          socket.emit("error", { message: "No API key or credits available" });
          return;
        }
        await db.update(elyCredits).set({ balance: credits.balance - 1 }).where(eq(elyCredits.userId, userId));
        apiKey = process.env.OPENAI_API_KEY;
      } else {
        apiKey = process.env.OPENAI_API_KEY;
      }

      if (apiKey) {
        modelUsed = nexusCmd.model;
        const history = await getConversationMessages(conversationId, 20);
        const chatMessages = history.map((m) => ({
          role: m.role.toLowerCase(),
          content: m.content,
        }));

        for await (const chunk of streamNexusModel(
          nexusCmd.provider,
          nexusCmd.model,
          chatMessages,
          profile,
          apiKey
        )) {
          fullResponse += chunk;
          socket.emit("stream", { chunk });
        }
      }
    } else {
      const intent = detectModuleIntent(content);
      const systemPrompt = buildSystemPrompt(
        profile,
        user.customInstructions,
        memoryTexts
      );

      if (intent.module && moduleHandlers[intent.module]) {
        const handler = moduleHandlers[intent.module]!;

        const result = await handler(content, {
          userId,
          profile: commProfile
            ? { styleSummary: commProfile.styleSummary, systemPromptAddendum: commProfile.systemPromptAddendum, preferences: commProfile.preferences as Record<string, unknown> }
            : getNeutralProfile(),
          preferences: (commProfile?.preferences as Record<string, unknown>) || {},
        });

        fullResponse = result.response;
        socket.emit("stream", { chunk: fullResponse });

        await logTaskExecution(
          userId,
          intent.module as "CONCIERGE" | "SCRIBE" | "KITCHEN_BRAIN" | "HABIT_ARCHITECT" | "RESEARCHER" | "MONEY_SCOUT",
          content,
          fullResponse,
          result.metadata
        );
      } else {
        const history = await getConversationMessages(conversationId, 20);
        const chatMessages = history
          .filter((m) => m.role !== "SYSTEM")
          .map((m) => ({
            role: m.role.toLowerCase() as "user" | "assistant",
            content: m.content,
          }));

        for await (const chunk of streamElyCore(chatMessages, systemPrompt)) {
          fullResponse += chunk;
          socket.emit("stream", { chunk });
        }
      }
    }

    await saveMessage(conversationId, "ASSISTANT", fullResponse, modelUsed);
    socket.emit("done", { content: fullResponse, model: modelUsed });
    socket.emit("avatar_state", { state: "idle" });

    await recordChatActivity(userId);

    try {
      const newMemories = await extractMemories(content, fullResponse);
      for (const mem of newMemories) {
        await saveMemory(userId, mem);
      }
    } catch {
      // memory extraction is best-effort
    }
  });

  socket.on("typing", () => {
    socket.to(socket.data.conversationId).emit("typing");
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

httpServer.listen(port, () => {
  console.log(`ELY WebSocket server running on port ${port}`);
});
