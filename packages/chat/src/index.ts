import { eq, desc } from "drizzle-orm";
import {
  getDb,
  conversations,
  messages,
  memories,
  taskExecutions,
} from "@ely/db";
import { updateStreak, awardXp, completeQuest } from "@ely/gamification";

export async function getOrCreateConversation(userId: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(1);

  if (existing) return existing;

  const [conv] = await db
    .insert(conversations)
    .values({ userId, title: "Chat with ELY" })
    .returning();

  return conv!;
}

export async function saveMessage(
  conversationId: string,
  role: "USER" | "ASSISTANT" | "SYSTEM",
  content: string,
  modelUsed?: string,
  metadata?: Record<string, unknown>
) {
  const db = getDb();
  const [msg] = await db
    .insert(messages)
    .values({ conversationId, role, content, modelUsed, metadata })
    .returning();

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return msg;
}

export async function getConversationMessages(conversationId: string, limit = 50) {
  const db = getDb();
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
    .limit(limit);
}

export async function getUserMemories(userId: string, limit = 10) {
  const db = getDb();
  return db
    .select()
    .from(memories)
    .where(eq(memories.userId, userId))
    .orderBy(desc(memories.importance))
    .limit(limit);
}

export async function saveMemory(userId: string, content: string, category?: string) {
  const db = getDb();
  await db.insert(memories).values({ userId, content, category });
}

export async function logTaskExecution(
  userId: string,
  module: "CONCIERGE" | "SCRIBE" | "KITCHEN_BRAIN" | "HABIT_ARCHITECT" | "RESEARCHER" | "MONEY_SCOUT",
  input: string,
  output: string,
  metadata?: Record<string, unknown>
) {
  const db = getDb();
  await db.insert(taskExecutions).values({ userId, module, input, output, metadata });
}

export async function recordChatActivity(userId: string) {
  await updateStreak(userId);
  await awardXp(userId, 5);
  await completeQuest(userId, "daily_chat");
}
