import { eq } from "drizzle-orm";
import { getDb, users, communicationProfiles, userApiKeys, elyCredits } from "@ely/db";
import { getNeutralProfile, resolveLlmProvider, getGeminiModel } from "@ely/personality";
import {
  buildSystemPrompt,
  completeElyCore,
  detectModuleIntent,
  parseNexusCommand,
  extractMemories,
  moduleHandlers,
  decryptApiKey,
  callNexusModel,
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

export async function handleChatMessage(userId: string, content: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("User not found");

  const conv = await getOrCreateConversation(userId);
  await saveMessage(conv.id, "USER", content);

  const [commProfile] = await db
    .select()
    .from(communicationProfiles)
    .where(eq(communicationProfiles.userId, userId))
    .limit(1);

  const profile = commProfile
    ? {
        styleSummary: commProfile.styleSummary,
        systemPromptAddendum: commProfile.systemPromptAddendum,
        preferences: commProfile.preferences as Record<string, unknown>,
      }
    : getNeutralProfile();

  const userMemories = await getUserMemories(userId, 5);
  const memoryTexts = userMemories.map((m) => m.content);

  const nexusCmd = parseNexusCommand(content);
  let fullResponse = "";
  let modelUsed = resolveLlmProvider() === "gemini" ? getGeminiModel() : "gpt-4o-mini";

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
      if (!credits || credits.balance <= 0) throw new Error("No API key or credits available");
      await db.update(elyCredits).set({ balance: credits.balance - 1 }).where(eq(elyCredits.userId, userId));
      apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    } else {
      apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    }

    if (!apiKey) throw new Error("Model Nexus unavailable");

    modelUsed = nexusCmd.model;
    const history = await getConversationMessages(conv.id, 20);
    fullResponse = await callNexusModel(
      nexusCmd.provider,
      nexusCmd.model,
      history.map((m) => ({ role: m.role.toLowerCase(), content: m.content })),
      profile,
      apiKey
    );
  } else {
    const intent = detectModuleIntent(content);
    const systemPrompt = buildSystemPrompt(profile, user.customInstructions, memoryTexts);

    if (intent.module && moduleHandlers[intent.module]) {
      const handler = moduleHandlers[intent.module]!;
      const result = await handler(content, {
        userId,
        profile,
        preferences: (commProfile?.preferences as Record<string, unknown>) || {},
      });
      fullResponse = result.response;
      await logTaskExecution(
        userId,
        intent.module as "CONCIERGE" | "SCRIBE" | "KITCHEN_BRAIN" | "HABIT_ARCHITECT" | "RESEARCHER" | "MONEY_SCOUT",
        content,
        fullResponse,
        result.metadata
      );
    } else {
      const history = await getConversationMessages(conv.id, 20);
      const chatMessages = history
        .filter((m) => m.role !== "SYSTEM")
        .map((m) => ({
          role: m.role.toLowerCase() as "user" | "assistant",
          content: m.content,
        }));
      fullResponse = await completeElyCore(chatMessages, systemPrompt);
    }
  }

  await saveMessage(conv.id, "ASSISTANT", fullResponse, modelUsed);
  await recordChatActivity(userId);

  try {
    const newMemories = await extractMemories(content, fullResponse);
    for (const mem of newMemories) {
      await saveMemory(userId, mem);
    }
  } catch {
    // best-effort
  }

  return { content: fullResponse, model: modelUsed, conversationId: conv.id };
}
