import { and, desc, eq, ne, sql } from "drizzle-orm";
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
  socialConversationFolders,
  socialConversationUserPrefs,
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
  type: "DIRECT" | "GROUP" | "AI_PERSONA" | "GROUP_AI";
  title: string;
  subtitle: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  peerId?: string;
  peerName?: string | null;
  peerAvatarUrl?: string | null;
  topic?: string;
  folderId?: string | null;
  archived?: boolean;
  participantCount?: number;
  participantNames?: string[];
};

export type ConversationFolder = {
  id: string;
  name: string;
  kind: "real" | "avatar";
  sortOrder: number;
  conversationCount: number;
};

type ConvMetadata = {
  readBy?: Record<string, string>;
  topic?: string;
  exchanges?: number;
  initiatorId?: string;
  targetUserId?: string;
  initiatorName?: string;
  targetName?: string;
  recipientId?: string;
  recipientName?: string;
  participantNames?: Record<string, string>;
  participantProfiles?: { userId: string; name: string }[];
};

function isRealConversation(type: string) {
  return type === "DIRECT" || type === "GROUP";
}

function isAvatarConversation(type: string) {
  return type === "AI_PERSONA" || type === "GROUP_AI";
}

function sortedIds(ids: string[]): string[] {
  return [...new Set(ids)].sort();
}

function participantKey(ids: string[]): string {
  return sortedIds(ids).join(":");
}

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

export async function getConversationInbox(
  userId: string,
  opts?: { view?: "active" | "archived"; folderId?: string | null }
): Promise<{
  direct: ConversationInboxItem[];
  avatar: ConversationInboxItem[];
  totalUnread: number;
  folders: ConversationFolder[];
}> {
  await ensureSocialTables();
  const db = getDb();
  const view = opts?.view ?? "active";
  const folderFilter = opts?.folderId;

  const [rows, prefRows, folderRows] = await Promise.all([
    listMySocialConversations(userId),
    db.select().from(socialConversationUserPrefs).where(eq(socialConversationUserPrefs.userId, userId)),
    db
      .select()
      .from(socialConversationFolders)
      .where(eq(socialConversationFolders.userId, userId))
      .orderBy(socialConversationFolders.sortOrder, socialConversationFolders.createdAt),
  ]);

  const prefMap = new Map(prefRows.map((p) => [p.conversationId, p]));
  const folderCounts = new Map<string, number>();

  const allParticipantIds = new Set<string>();
  for (const conv of rows) {
    const pref = prefMap.get(conv.id);
    if (pref?.deletedAt) continue;
    for (const id of (conv.participantIds as string[]) || []) {
      if (id !== userId) allParticipantIds.add(id);
    }
  }

  const userInfoMap = new Map<string, { name: string | null; avatarUrl: string | null }>();
  for (const pid of allParticipantIds) {
    const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, pid)).limit(1);
    const [a] = await db.select({ imageUrl: avatars.imageUrl }).from(avatars).where(eq(avatars.userId, pid)).limit(1);
    userInfoMap.set(pid, { name: u?.name ?? null, avatarUrl: a?.imageUrl ?? null });
  }

  const direct: ConversationInboxItem[] = [];
  const avatar: ConversationInboxItem[] = [];

  for (const conv of rows) {
    const pref = prefMap.get(conv.id);
    if (pref?.deletedAt) continue;

    const isArchived = !!pref?.archivedAt;
    if (view === "active" && isArchived) continue;
    if (view === "archived" && !isArchived) continue;

    const prefFolderId = pref?.folderId ?? null;
    if (folderFilter !== undefined) {
      if (folderFilter === null && prefFolderId !== null) continue;
      if (folderFilter !== null && prefFolderId !== folderFilter) continue;
    }

    if (prefFolderId) {
      folderCounts.set(prefFolderId, (folderCounts.get(prefFolderId) || 0) + 1);
    }

    const metadata = (conv.metadata || {}) as ConvMetadata;
    const readAt = getReadAt(metadata, userId);
    const participantIds = (conv.participantIds as string[]) || [];
    const otherIds = participantIds.filter((id) => id !== userId);
    const peerId = otherIds.length === 1 ? otherIds[0] : undefined;

    const msgs = await db
      .select()
      .from(socialMessages)
      .where(eq(socialMessages.conversationId, conv.id))
      .orderBy(desc(socialMessages.createdAt))
      .limit(50);

    const last = msgs[0];
    let unreadCount = 0;

    if (isRealConversation(conv.type)) {
      unreadCount = msgs.filter(
        (m) => m.senderId && m.senderId !== userId && new Date(m.createdAt) > readAt
      ).length;
    } else {
      const neverRead = !metadata.readBy?.[userId];
      const isInitiator = metadata.initiatorId === userId || conv.createdById === userId;
      const isLegacyTarget = metadata.targetUserId === userId && metadata.initiatorId !== userId;
      const isGroupParticipant = conv.type === "GROUP_AI" && participantIds.includes(userId) && !isInitiator;

      if (neverRead && (isLegacyTarget || isGroupParticipant)) {
        unreadCount = msgs.length > 0 ? 1 : 0;
      } else if (neverRead && isInitiator) {
        unreadCount = 0;
      } else if (new Date(conv.updatedAt) > readAt) {
        unreadCount = 1;
      }
    }

    const peer = peerId ? userInfoMap.get(peerId) : undefined;
    const participantNames = otherIds.map((id) => metadata.participantNames?.[id] || userInfoMap.get(id)?.name || "Traveler");

    let title = conv.title;
    if (conv.type === "DIRECT" && peer?.name) title = `Chat with ${peer.name}`;
    if (conv.type === "GROUP" && !title.startsWith("Group:")) {
      title = title || `Group: ${participantNames.slice(0, 3).join(", ")}`;
    }

    const item: ConversationInboxItem = {
      id: conv.id,
      type: conv.type as ConversationInboxItem["type"],
      title,
      subtitle:
        conv.type === "DIRECT"
          ? last?.senderId === userId
            ? "You sent a message"
            : `${peer?.name || "Traveler"} messaged you`
          : conv.type === "GROUP"
            ? `${participantIds.length} members`
            : metadata.topic || "AI persona dialogue",
      lastMessage: last?.content?.slice(0, 120) ?? null,
      lastMessageAt: last?.createdAt?.toISOString() ?? conv.updatedAt?.toISOString() ?? null,
      unreadCount: view === "archived" ? 0 : unreadCount,
      peerId,
      peerName: peer?.name,
      peerAvatarUrl: peer?.avatarUrl,
      topic: metadata.topic,
      folderId: prefFolderId,
      archived: isArchived,
      participantCount: participantIds.length,
      participantNames,
    };

    if (isRealConversation(conv.type)) direct.push(item);
    else avatar.push(item);
  }

  direct.sort((a, b) => (b.lastMessageAt || "").localeCompare(a.lastMessageAt || ""));
  avatar.sort((a, b) => (b.lastMessageAt || "").localeCompare(a.lastMessageAt || ""));

  const totalUnread =
    direct.reduce((s, c) => s + c.unreadCount, 0) + avatar.reduce((s, c) => s + c.unreadCount, 0);

  const folders: ConversationFolder[] = folderRows.map((f) => ({
    id: f.id,
    name: f.name,
    kind: f.kind,
    sortOrder: f.sortOrder,
    conversationCount: folderCounts.get(f.id) || 0,
  }));

  return { direct, avatar, totalUnread, folders };
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

  const participantIds = (conv.participantIds as string[]) || [];
  const metadata = (conv.metadata || {}) as ConvMetadata;
  const participants: { id: string; name: string; avatarUrl: string | null }[] = [];

  for (const pid of participantIds) {
    const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, pid)).limit(1);
    const [a] = await db.select({ imageUrl: avatars.imageUrl }).from(avatars).where(eq(avatars.userId, pid)).limit(1);
    participants.push({
      id: pid,
      name: metadata.participantNames?.[pid] || u?.name || "Traveler",
      avatarUrl: a?.imageUrl ?? null,
    });
  }

  return { conversation: conv, messages, participants };
}

export async function sendDirectMessage(conversationId: string, senderId: string, content: string) {
  await ensureSocialTables();
  const db = getDb();
  const { conversation } = await getSocialConversation(conversationId, senderId, { skipMarkRead: true });
  if (!isRealConversation(conversation.type)) throw new Error("Not a direct message thread");

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

async function upsertUserPref(
  userId: string,
  conversationId: string,
  patch: Partial<{ folderId: string | null; archivedAt: Date | null; deletedAt: Date | null }>
) {
  await ensureSocialTables();
  const db = getDb();
  const [existing] = await db
    .select()
    .from(socialConversationUserPrefs)
    .where(
      and(
        eq(socialConversationUserPrefs.userId, userId),
        eq(socialConversationUserPrefs.conversationId, conversationId)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(socialConversationUserPrefs)
      .set({
        folderId: patch.folderId !== undefined ? patch.folderId : existing.folderId,
        archivedAt: patch.archivedAt !== undefined ? patch.archivedAt : existing.archivedAt,
        deletedAt: patch.deletedAt !== undefined ? patch.deletedAt : existing.deletedAt,
      })
      .where(
        and(
          eq(socialConversationUserPrefs.userId, userId),
          eq(socialConversationUserPrefs.conversationId, conversationId)
        )
      );
  } else {
    await db.insert(socialConversationUserPrefs).values({
      userId,
      conversationId,
      folderId: patch.folderId ?? null,
      archivedAt: patch.archivedAt ?? null,
      deletedAt: patch.deletedAt ?? null,
    });
  }
}

export async function archiveConversation(conversationId: string, userId: string) {
  await getSocialConversation(conversationId, userId, { skipMarkRead: true });
  await upsertUserPref(userId, conversationId, { archivedAt: new Date() });
  return { success: true };
}

export async function unarchiveConversation(conversationId: string, userId: string) {
  await getSocialConversation(conversationId, userId, { skipMarkRead: true });
  await upsertUserPref(userId, conversationId, { archivedAt: null });
  return { success: true };
}

export async function deleteConversationForUser(conversationId: string, userId: string) {
  await getSocialConversation(conversationId, userId, { skipMarkRead: true });
  await upsertUserPref(userId, conversationId, { deletedAt: new Date() });
  return { success: true };
}

export async function setConversationFolder(
  conversationId: string,
  userId: string,
  folderId: string | null
) {
  await getSocialConversation(conversationId, userId, { skipMarkRead: true });
  if (folderId) {
    const db = getDb();
    const [folder] = await db
      .select()
      .from(socialConversationFolders)
      .where(and(eq(socialConversationFolders.id, folderId), eq(socialConversationFolders.userId, userId)))
      .limit(1);
    if (!folder) throw new Error("Folder not found");
  }
  await upsertUserPref(userId, conversationId, { folderId });
  return { success: true };
}

export async function listConversationFolders(userId: string): Promise<ConversationFolder[]> {
  const inbox = await getConversationInbox(userId);
  return inbox.folders;
}

export async function createConversationFolder(
  userId: string,
  name: string,
  kind: "real" | "avatar"
) {
  await ensureSocialTables();
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name required");

  const [folder] = await db
    .insert(socialConversationFolders)
    .values({ userId, name: trimmed, kind, sortOrder: 0 })
    .returning();

  return { folder: { id: folder!.id, name: folder!.name, kind: folder!.kind, sortOrder: folder!.sortOrder, conversationCount: 0 } };
}

export async function updateConversationFolder(userId: string, folderId: string, name: string) {
  await ensureSocialTables();
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name required");

  const [folder] = await db
    .update(socialConversationFolders)
    .set({ name: trimmed })
    .where(and(eq(socialConversationFolders.id, folderId), eq(socialConversationFolders.userId, userId)))
    .returning();

  if (!folder) throw new Error("Folder not found");
  return { folder };
}

export async function deleteConversationFolder(userId: string, folderId: string) {
  await ensureSocialTables();
  const db = getDb();
  await db
    .delete(socialConversationFolders)
    .where(and(eq(socialConversationFolders.id, folderId), eq(socialConversationFolders.userId, userId)));

  await db
    .update(socialConversationUserPrefs)
    .set({ folderId: null })
    .where(and(eq(socialConversationUserPrefs.userId, userId), eq(socialConversationUserPrefs.folderId, folderId)));

  return { success: true };
}

export async function exportConversationTxt(conversationId: string, userId: string) {
  const { conversation, messages } = await getSocialConversation(conversationId, userId, {
    skipMarkRead: true,
  });
  const metadata = (conversation.metadata || {}) as ConvMetadata;
  const db = getDb();

  const senderNames = new Map<string, string>();
  for (const pid of (conversation.participantIds as string[]) || []) {
    const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, pid)).limit(1);
    senderNames.set(pid, metadata.participantNames?.[pid] || u?.name || "Traveler");
  }

  const lines: string[] = [
    conversation.title,
    `Type: ${conversation.type}`,
    metadata.topic ? `Topic: ${metadata.topic}` : "",
    `Exported: ${new Date().toISOString()}`,
    "",
    "---",
    "",
  ].filter(Boolean);

  for (const msg of messages) {
    const meta = (msg.metadata || {}) as { speakerName?: string; personaSide?: string };
    const when = new Date(msg.createdAt).toLocaleString();
    let speaker = meta.speakerName || "Unknown";
    if (msg.senderId && senderNames.has(msg.senderId)) {
      speaker = senderNames.get(msg.senderId)!;
    }
    if (msg.senderId === userId) speaker = "You";
    lines.push(`[${when}] ${speaker}:`);
    lines.push(msg.content);
    lines.push("");
  }

  const safeTitle = conversation.title.replace(/[^\w\s-]/g, "").slice(0, 40).trim() || "conversation";
  return {
    filename: `${safeTitle}.txt`,
    content: lines.join("\n"),
  };
}

export async function startGroupDirectMessage(
  creatorId: string,
  participantIds: string[],
  title?: string
) {
  await ensureSocialTables();
  const db = getDb();
  const all = sortedIds([creatorId, ...participantIds]);
  if (all.length < 3) throw new Error("Group chat needs at least 3 people");
  if (all.length > 8) throw new Error("Maximum 8 participants");

  const key = participantKey(all);
  const existing = await db.select().from(socialConversations).where(eq(socialConversations.type, "GROUP"));

  for (const conv of existing) {
    if (participantKey((conv.participantIds as string[]) || []) === key) {
      return { conversation: conv, created: false };
    }
  }

  const nameMap: Record<string, string> = {};
  const names: string[] = [];
  for (const pid of all) {
    const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, pid)).limit(1);
    if (!u) throw new Error("User not found");
    nameMap[pid] = u.name || "Traveler";
    if (pid !== creatorId) names.push(nameMap[pid]);
  }

  const groupTitle = title?.trim() || `Group: ${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""}`;

  const [conversation] = await db
    .insert(socialConversations)
    .values({
      type: "GROUP",
      createdById: creatorId,
      participantIds: all,
      title: groupTitle,
      metadata: { participantNames: nameMap, initiatorId: creatorId },
    })
    .returning();

  return { conversation, created: true };
}

export async function addGroupParticipants(
  conversationId: string,
  userId: string,
  newParticipantIds: string[]
) {
  await ensureSocialTables();
  const db = getDb();
  const { conversation } = await getSocialConversation(conversationId, userId, { skipMarkRead: true });
  if (conversation.type !== "GROUP") throw new Error("Not a group conversation");

  const current = (conversation.participantIds as string[]) || [];
  const merged = sortedIds([...current, ...newParticipantIds]);
  if (merged.length > 8) throw new Error("Maximum 8 participants");

  const metadata = (conversation.metadata || {}) as ConvMetadata;
  const nameMap = { ...(metadata.participantNames || {}) };

  for (const pid of newParticipantIds) {
    if (current.includes(pid)) continue;
    const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, pid)).limit(1);
    if (!u) throw new Error("User not found");
    nameMap[pid] = u.name || "Traveler";
  }

  const [updated] = await db
    .update(socialConversations)
    .set({
      participantIds: merged,
      metadata: { ...metadata, participantNames: nameMap },
      updatedAt: new Date(),
    })
    .where(eq(socialConversations.id, conversationId))
    .returning();

  return { conversation: updated };
}

export async function startGroupAiPersonaBattle(input: {
  initiatorId: string;
  participantIds: string[];
  topic: string;
  exchanges: number;
}) {
  await ensureSocialTables();
  const { initiatorId, participantIds, topic, exchanges } = input;
  const all = sortedIds([initiatorId, ...participantIds]);
  if (all.length < 3) throw new Error("Group AI chat needs at least 3 personas");
  if (all.length > 6) throw new Error("Maximum 6 personas in group AI chat");
  if (all.includes(initiatorId) === false) throw new Error("Invalid participants");

  const db = getDb();
  const platformConfig = await getPlatformConfig();
  const llmKeys = toLlmKeySource(platformConfig);
  const clampedExchanges = Math.min(6, Math.max(2, exchanges));

  const profiles: { userId: string; name: string; styleSummary: string; avatarUrl: string | null }[] = [];
  const nameMap: Record<string, string> = {};
  const labels = "ABCDEF".split("");

  for (let i = 0; i < all.length; i++) {
    const uid = all[i]!;
    const [user] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    if (!user) throw new Error("User not found");
    const [avatar] = await db.select().from(avatars).where(eq(avatars.userId, uid)).limit(1);
    const profile = await profileForUser(uid);
    const name = user.name || `Traveler ${labels[i]}`;
    nameMap[uid] = name;
    profiles.push({ userId: uid, name, styleSummary: profile.styleSummary, avatarUrl: avatar?.imageUrl ?? null });
  }

  const totalLines = clampedExchanges * all.length;
  const speakerList = profiles.map((p, i) => `${labels[i]} = ${p.name}`).join(", ");

  const systemPrompt = `You write dialogue between ${all.length} AI persona avatars in a friendly social app.
Return JSON: { "lines": [ { "speaker": "A"|"B"|"C"|..., "content": "..." } ] }
Exactly ${totalLines} lines. Rotate speakers in order: ${labels.slice(0, all.length).join(" → ")} → repeat.
Speakers: ${speakerList}
Topic: ${topic}
Keep each line under 200 characters. Distinct voices, warm tone. No markdown.`;

  const userPrompt = profiles
    .map((p, i) => `Persona ${labels[i]} (${p.name}): ${p.styleSummary}`)
    .join("\n");

  let lines: { speaker: string; content: string }[] = [];

  try {
    const raw = await completeElyCore(
      [{ role: "user", content: `${userPrompt}\n\nGenerate ${clampedExchanges} full rounds (${totalLines} lines) about: ${topic}` }],
      systemPrompt,
      { llmKeys }
    );
    const parsed = JSON.parse(raw || "{}") as { lines?: { speaker: string; content: string }[] };
    const validLabels = new Set(labels.slice(0, all.length));
    lines = (parsed.lines || [])
      .filter((l) => l.content?.trim() && validLabels.has(l.speaker?.toUpperCase()?.[0] || ""))
      .slice(0, totalLines)
      .map((l) => ({
        speaker: (l.speaker.toUpperCase()[0] || "A") as string,
        content: l.content.trim(),
      }));
  } catch {
    lines = [];
  }

  if (lines.length < all.length * 2) {
    lines = Array.from({ length: totalLines }, (_, i) => {
      const label = labels[i % all.length]!;
      const profile = profiles[i % all.length]!;
      return {
        speaker: label,
        content: `${profile.name}: ${i % all.length === 0 ? `On ${topic.toLowerCase()}, I think we each bring something unique.` : "That's an interesting angle — here's my take."}`,
      };
    });
  }

  const titleNames = profiles.map((p) => p.name).join(", ");
  const [conversation] = await db
    .insert(socialConversations)
    .values({
      type: "GROUP_AI",
      createdById: initiatorId,
      participantIds: all,
      title: `${titleNames}: ${topic}`,
      metadata: {
        topic,
        exchanges: clampedExchanges,
        initiatorId,
        participantNames: nameMap,
        participantProfiles: profiles.map((p) => ({ userId: p.userId, name: p.name })),
        readBy: { [initiatorId]: new Date().toISOString() },
      },
    })
    .returning();

  const messageRows = lines.map((line, idx) => {
    const labelIndex = labels.indexOf(line.speaker);
    const profile = profiles[labelIndex >= 0 ? labelIndex : idx % profiles.length]!;
    return {
      conversationId: conversation!.id,
      senderId: profile.userId,
      role: "ASSISTANT" as const,
      content: line.content,
      metadata: {
        personaSide: line.speaker,
        speakerName: profile.name,
        avatarUrl: profile.avatarUrl,
      },
    };
  });

  await db.insert(socialMessages).values(messageRows);
  return getSocialConversation(conversation!.id, initiatorId);
}
