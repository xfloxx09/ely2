import { desc, eq, ne, sql } from "drizzle-orm";
import {
  getDb,
  ensureSocialTables,
  users,
  avatars,
  userXp,
  streaks,
  communicationProfiles,
  socialConversations,
  socialMessages,
} from "@ely/db";
import { completeElyCore } from "@ely/ai";
import { getNeutralProfile } from "@ely/personality";
import { getPlatformConfig, toLlmKeySource } from "./platform-config.js";

export const AI_BATTLE_TOPICS = [
  "First impressions",
  "Dream vacation together",
  "Debating the perfect pizza topping",
  "Life advice swap",
  "Creative collaboration on a startup",
  "Philosophy over coffee",
];

export type CommunityUser = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  level: number;
  totalXp: number;
  currentStreak: number;
  styleSummary: string | null;
};

export type ConversationInboxItem = {
  id: string;
  type: "DIRECT" | "AI_PERSONA";
  title: string;
  subtitle: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  peerId?: string;
  peerName?: string | null;
  peerAvatarUrl?: string | null;
  topic?: string;
};

type ConvMetadata = {
  readBy?: Record<string, string>;
  topic?: string;
  initiatorId?: string;
  targetUserId?: string;
  initiatorName?: string;
  targetName?: string;
  recipientId?: string;
  recipientName?: string;
};

function getReadAt(metadata: ConvMetadata, userId: string): Date {
  const iso = metadata.readBy?.[userId];
  return iso ? new Date(iso) : new Date(0);
}

function withReadAt(metadata: ConvMetadata, userId: string): ConvMetadata {
  return {
    ...metadata,
    readBy: { ...(metadata.readBy || {}), [userId]: new Date().toISOString() },
  };
}

async function profileForUser(userId: string) {
  const db = getDb();
  const [commProfile] = await db
    .select()
    .from(communicationProfiles)
    .where(eq(communicationProfiles.userId, userId))
    .limit(1);

  return commProfile
    ? {
        styleSummary: commProfile.styleSummary,
        systemPromptAddendum: commProfile.systemPromptAddendum,
        preferences: commProfile.preferences as Record<string, unknown>,
      }
    : getNeutralProfile();
}

export async function getCommunityUsers(currentUserId: string, limit = 48): Promise<CommunityUser[]> {
  await ensureSocialTables();
  const db = getDb();

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: avatars.imageUrl,
      level: userXp.level,
      totalXp: userXp.totalXp,
      currentStreak: streaks.currentStreak,
      styleSummary: communicationProfiles.styleSummary,
    })
    .from(users)
    .leftJoin(avatars, eq(avatars.userId, users.id))
    .leftJoin(userXp, eq(userXp.userId, users.id))
    .leftJoin(streaks, eq(streaks.userId, users.id))
    .leftJoin(communicationProfiles, eq(communicationProfiles.userId, users.id))
    .where(ne(users.id, currentUserId))
    .orderBy(desc(userXp.totalXp))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    avatarUrl: r.avatarUrl,
    level: r.level ?? 1,
    totalXp: r.totalXp ?? 0,
    currentStreak: r.currentStreak ?? 0,
    styleSummary: r.styleSummary,
  }));
}

export async function getCommunityLeaderboard(currentUserId: string) {
  await ensureSocialTables();
  const db = getDb();

  const xpBoard = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: avatars.imageUrl,
      level: userXp.level,
      totalXp: userXp.totalXp,
    })
    .from(userXp)
    .innerJoin(users, eq(users.id, userXp.userId))
    .leftJoin(avatars, eq(avatars.userId, users.id))
    .orderBy(desc(userXp.totalXp))
    .limit(10);

  const streakBoard = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: avatars.imageUrl,
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak,
    })
    .from(streaks)
    .innerJoin(users, eq(users.id, streaks.userId))
    .leftJoin(avatars, eq(avatars.userId, users.id))
    .orderBy(desc(streaks.currentStreak))
    .limit(10);

  const myXp = await db.select().from(userXp).where(eq(userXp.userId, currentUserId)).limit(1);
  const myRank =
    myXp[0]?.totalXp != null
      ? (
          await db
            .select({ count: sql<number>`count(*)::int` })
            .from(userXp)
            .where(sql`${userXp.totalXp} > ${myXp[0].totalXp}`)
        )[0]?.count ?? 0
      : null;

  return {
    xp: xpBoard,
    streaks: streakBoard,
    myRank: myRank != null ? myRank + 1 : null,
    myXp: myXp[0]?.totalXp ?? 0,
  };
}

function sortedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function startDirectMessage(senderId: string, recipientId: string) {
  await ensureSocialTables();
  if (senderId === recipientId) throw new Error("Cannot message yourself");

  const db = getDb();
  const [recipient] = await db.select().from(users).where(eq(users.id, recipientId)).limit(1);
  if (!recipient) throw new Error("User not found");

  const participants = sortedPair(senderId, recipientId);
  const existing = await db.select().from(socialConversations).where(eq(socialConversations.type, "DIRECT"));

  for (const conv of existing) {
    const ids = (conv.participantIds as string[]) || [];
    if (ids.includes(participants[0]) && ids.includes(participants[1])) {
      return { conversation: conv, created: false };
    }
  }

  const title = recipient.name ? `Chat with ${recipient.name}` : "Direct message";
  const [conversation] = await db
    .insert(socialConversations)
    .values({
      type: "DIRECT",
      createdById: senderId,
      participantIds: participants,
      title,
      metadata: { recipientId, recipientName: recipient.name },
    })
    .returning();

  return { conversation, created: true };
}

export async function listMySocialConversations(userId: string) {
  await ensureSocialTables();
  const db = getDb();
  const rows = await db.select().from(socialConversations).orderBy(desc(socialConversations.updatedAt));

  return rows.filter((c) => {
    const ids = (c.participantIds as string[]) || [];
    return ids.includes(userId) || c.createdById === userId;
  });
}

export async function markConversationRead(conversationId: string, userId: string) {
  await ensureSocialTables();
  const db = getDb();
  const { conversation } = await getSocialConversation(conversationId, userId, { skipMarkRead: true });
  const metadata = (conversation.metadata || {}) as ConvMetadata;

  await db
    .update(socialConversations)
    .set({
      metadata: withReadAt(metadata, userId),
      updatedAt: conversation.updatedAt,
    })
    .where(eq(socialConversations.id, conversationId));

  return { success: true };
}

export async function getUnreadConversationCount(userId: string): Promise<number> {
  const inbox = await getConversationInbox(userId);
  return inbox.direct.reduce((s, c) => s + c.unreadCount, 0) + inbox.avatar.reduce((s, c) => s + c.unreadCount, 0);
}

export async function getConversationInbox(userId: string): Promise<{
  direct: ConversationInboxItem[];
  avatar: ConversationInboxItem[];
  totalUnread: number;
}> {
  await ensureSocialTables();
  const db = getDb();
  const rows = await listMySocialConversations(userId);

  const peerIds = new Set<string>();
  for (const conv of rows) {
    const ids = (conv.participantIds as string[]) || [];
    const peer = ids.find((id) => id !== userId);
    if (peer) peerIds.add(peer);
  }

  const peerMap = new Map<string, { name: string | null; avatarUrl: string | null }>();
  if (peerIds.size) {
    const peerList = [...peerIds];
    for (const peerId of peerList) {
      const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, peerId)).limit(1);
      const [a] = await db.select({ imageUrl: avatars.imageUrl }).from(avatars).where(eq(avatars.userId, peerId)).limit(1);
      peerMap.set(peerId, { name: u?.name ?? null, avatarUrl: a?.imageUrl ?? null });
    }
  }

  const direct: ConversationInboxItem[] = [];
  const avatar: ConversationInboxItem[] = [];

  for (const conv of rows) {
    const metadata = (conv.metadata || {}) as ConvMetadata;
    const readAt = getReadAt(metadata, userId);
    const participantIds = (conv.participantIds as string[]) || [];
    const peerId = participantIds.find((id) => id !== userId);

    const msgs = await db
      .select()
      .from(socialMessages)
      .where(eq(socialMessages.conversationId, conv.id))
      .orderBy(desc(socialMessages.createdAt))
      .limit(50);

    const last = msgs[0];
    let unreadCount = 0;

    if (conv.type === "DIRECT") {
      unreadCount = msgs.filter(
        (m) => m.senderId && m.senderId !== userId && new Date(m.createdAt) > readAt
      ).length;
    } else {
      const neverRead = !metadata.readBy?.[userId];
      const isTarget = metadata.targetUserId === userId && metadata.initiatorId !== userId;
      if (neverRead && (isTarget || conv.createdById !== userId)) {
        unreadCount = msgs.length > 0 ? 1 : 0;
      } else if (neverRead && conv.createdById === userId) {
        unreadCount = 0;
      } else if (new Date(conv.updatedAt) > readAt) {
        unreadCount = 1;
      }
    }

    const peer = peerId ? peerMap.get(peerId) : undefined;
    const item: ConversationInboxItem = {
      id: conv.id,
      type: conv.type,
      title:
        conv.type === "DIRECT"
          ? peer?.name
            ? `Chat with ${peer.name}`
            : conv.title
          : conv.title,
      subtitle:
        conv.type === "DIRECT"
          ? last?.senderId === userId
            ? "You sent a message"
            : `${peer?.name || "Traveler"} messaged you`
          : metadata.topic || "AI persona dialogue",
      lastMessage: last?.content?.slice(0, 120) ?? null,
      lastMessageAt: last?.createdAt?.toISOString() ?? conv.updatedAt?.toISOString() ?? null,
      unreadCount,
      peerId,
      peerName: peer?.name,
      peerAvatarUrl: peer?.avatarUrl,
      topic: metadata.topic,
    };

    if (conv.type === "DIRECT") direct.push(item);
    else avatar.push(item);
  }

  direct.sort((a, b) => (b.lastMessageAt || "").localeCompare(a.lastMessageAt || ""));
  avatar.sort((a, b) => (b.lastMessageAt || "").localeCompare(a.lastMessageAt || ""));

  const totalUnread =
    direct.reduce((s, c) => s + c.unreadCount, 0) + avatar.reduce((s, c) => s + c.unreadCount, 0);

  return { direct, avatar, totalUnread };
}

export async function getSocialConversation(
  conversationId: string,
  userId: string,
  opts?: { skipMarkRead?: boolean }
) {
  await ensureSocialTables();
  const db = getDb();
  const [conv] = await db.select().from(socialConversations).where(eq(socialConversations.id, conversationId)).limit(1);
  if (!conv) throw new Error("Conversation not found");

  const ids = (conv.participantIds as string[]) || [];
  if (!ids.includes(userId) && conv.createdById !== userId) {
    throw new Error("Access denied");
  }

  const messages = await db
    .select()
    .from(socialMessages)
    .where(eq(socialMessages.conversationId, conversationId))
    .orderBy(socialMessages.createdAt);

  if (!opts?.skipMarkRead) {
    const metadata = (conv.metadata || {}) as ConvMetadata;
    await db
      .update(socialConversations)
      .set({ metadata: withReadAt(metadata, userId) })
      .where(eq(socialConversations.id, conversationId));
  }

  return { conversation: conv, messages };
}

export async function sendDirectMessage(conversationId: string, senderId: string, content: string) {
  await ensureSocialTables();
  const db = getDb();
  const { conversation } = await getSocialConversation(conversationId, senderId, { skipMarkRead: true });
  if (conversation.type !== "DIRECT") throw new Error("Not a direct message thread");

  const [message] = await db
    .insert(socialMessages)
    .values({
      conversationId,
      senderId,
      role: "USER",
      content,
    })
    .returning();

  await db
    .update(socialConversations)
    .set({ updatedAt: new Date() })
    .where(eq(socialConversations.id, conversationId));

  return message;
}

type AiBattleInput = {
  initiatorId: string;
  targetUserId: string;
  topic: string;
  exchanges: number;
};

export async function startAiPersonaBattle(input: AiBattleInput) {
  await ensureSocialTables();
  const { initiatorId, targetUserId, topic, exchanges } = input;
  if (initiatorId === targetUserId) throw new Error("Cannot battle yourself");

  const db = getDb();
  const [initiator, target] = await Promise.all([
    db.select().from(users).where(eq(users.id, initiatorId)).limit(1),
    db.select().from(users).where(eq(users.id, targetUserId)).limit(1),
  ]);

  if (!target[0] || !initiator[0]) throw new Error("User not found");

  const [initiatorAvatar, targetAvatar] = await Promise.all([
    db.select().from(avatars).where(eq(avatars.userId, initiatorId)).limit(1),
    db.select().from(avatars).where(eq(avatars.userId, targetUserId)).limit(1),
  ]);

  const initiatorProfile = await profileForUser(initiatorId);
  const targetProfile = await profileForUser(targetUserId);
  const platformConfig = await getPlatformConfig();
  const llmKeys = toLlmKeySource(platformConfig);

  const initiatorName = initiator[0].name || "Traveler A";
  const targetName = target[0].name || "Traveler B";
  const clampedExchanges = Math.min(8, Math.max(2, exchanges));
  const totalLines = clampedExchanges * 2;

  const systemPrompt = `You write dialogue between two AI persona avatars in a friendly social app.
Return JSON: { "lines": [ { "speaker": "A"|"B", "content": "..." } ] }
Exactly ${totalLines} lines, alternating speakers starting with A.
Speaker A is ${initiatorName}'s ELY persona. Speaker B is ${targetName}'s ELY persona.
Topic: ${topic}
Keep each line under 220 characters. Be distinct, warm, and personality-driven. No markdown.`;

  const userPrompt = `Persona A (${initiatorName}): ${initiatorProfile.styleSummary}
Persona B (${targetName}): ${targetProfile.styleSummary}

Generate ${clampedExchanges} back-and-forth exchanges (${totalLines} lines total) about: ${topic}`;

  let lines: { speaker: "A" | "B"; content: string }[] = [];

  try {
    const raw = await completeElyCore([{ role: "user", content: userPrompt }], systemPrompt, {
      llmKeys,
    });
    const parsed = JSON.parse(raw || "{}") as { lines?: { speaker: string; content: string }[] };
    lines = (parsed.lines || [])
      .filter((l) => l.content?.trim())
      .slice(0, totalLines)
      .map((l) => ({
        speaker: l.speaker === "B" ? "B" : "A",
        content: l.content.trim(),
      }));
  } catch {
    lines = [];
  }

  if (lines.length < 4) {
    lines = Array.from({ length: totalLines }, (_, i) => ({
      speaker: (i % 2 === 0 ? "A" : "B") as "A" | "B",
      content:
        i % 2 === 0
          ? `${initiatorName}: That's a fascinating take on ${topic.toLowerCase()}.`
          : `${targetName}: I see it differently — here's my perspective.`,
    }));
  }

  const [conversation] = await db
    .insert(socialConversations)
    .values({
      type: "AI_PERSONA",
      createdById: initiatorId,
      participantIds: sortedPair(initiatorId, targetUserId),
      title: `${initiatorName} × ${targetName}: ${topic}`,
      metadata: {
        topic,
        exchanges: clampedExchanges,
        initiatorId,
        targetUserId,
        initiatorName,
        targetName,
        readBy: { [initiatorId]: new Date().toISOString() },
      },
    })
    .returning();

  const messageRows = lines.map((line) => {
    const isA = line.speaker === "A";
    return {
      conversationId: conversation!.id,
      senderId: isA ? initiatorId : targetUserId,
      role: "ASSISTANT" as const,
      content: line.content,
      metadata: {
        personaSide: line.speaker,
        speakerName: isA ? initiatorName : targetName,
        avatarUrl: isA ? initiatorAvatar[0]?.imageUrl : targetAvatar[0]?.imageUrl,
      },
    };
  });

  await db.insert(socialMessages).values(messageRows);

  return getSocialConversation(conversation!.id, initiatorId);
}

export async function getUserPublicCard(userId: string, viewerId: string) {
  await ensureSocialTables();
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("User not found");

  const [avatar] = await db.select().from(avatars).where(eq(avatars.userId, userId)).limit(1);
  const [xp] = await db.select().from(userXp).where(eq(userXp.userId, userId)).limit(1);
  const [streak] = await db.select().from(streaks).where(eq(streaks.userId, userId)).limit(1);
  const [profile] = await db
    .select()
    .from(communicationProfiles)
    .where(eq(communicationProfiles.userId, userId))
    .limit(1);

  return {
    id: user.id,
    name: user.name,
    avatarUrl: avatar?.imageUrl ?? null,
    level: xp?.level ?? 1,
    totalXp: xp?.totalXp ?? 0,
    currentStreak: streak?.currentStreak ?? 0,
    styleSummary: profile?.styleSummary ?? null,
    isSelf: userId === viewerId,
  };
}
