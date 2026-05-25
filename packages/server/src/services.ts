import { eq, desc, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import {
  getDb,
  users,
  personalityAssessments,
  personalityScores,
  communicationProfiles,
  avatars,
  conversations,
  messages,
  memories,
  subscriptions,
  elyCredits,
  affiliates,
  commissions,
  userXp,
  streaks,
  userBadges,
  badges,
  avatarItems,
  userAvatarItems,
  userApiKeys,
  nexusRequests,
  taskExecutions,
  reminders,
  habits,
  mealPlans,
  spendingEntries,
  incomeDisclosures,
  avatarEvolutionEvents,
  dailyMessageCounts,
} from "@ely/db";
import {
  BFI2_SHORT,
  BFI2_LONG,
  scoreBFI2,
  encryptScores,
  buildCommunicationProfile,
  getNeutralProfile,
  mapTraitsToAvatarParams,
} from "@ely/personality";
import { generateAvatarImage, getPlaceholderAvatarUrl, encryptApiKey } from "@ely/ai";
import { enrollAffiliate, getNextRankProgress } from "@ely/mlm";
import { awardXp, updateStreak, completeQuest, checkAndAwardBadges, getDailyQuests } from "@ely/gamification";
import { generateReferralCode } from "@ely/mlm";
import { getAppUrl } from "./session.js";
import { getPlatformConfig } from "./platform-config.js";

export async function registerUser(email: string, password: string, name?: string, referralCode?: string) {
  const db = getDb();
  const hash = await bcrypt.hash(password, 12);
  const code = generateReferralCode();

  let referredById: string | undefined;
  if (referralCode) {
    const [referrer] = await db.select().from(users).where(eq(users.referralCode, referralCode)).limit(1);
    referredById = referrer?.id;
  }

  const [user] = await db
    .insert(users)
    .values({ email, passwordHash: hash, name, referralCode: code, referredById })
    .returning();

  if (!user) throw new Error("Registration failed");

  await db.insert(elyCredits).values({ userId: user.id, balance: 0, monthlyAllowance: 0 });
  await db.insert(userXp).values({ userId: user.id });
  await db.insert(streaks).values({ userId: user.id });

  return { id: user.id, email: user.email, name: user.name, tier: user.tier, referralCode: user.referralCode };
}

export async function loginUser(email: string, password: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.passwordHash) throw new Error("Invalid credentials");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("Invalid credentials");

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    tier: user.tier,
    role: user.role,
    referralCode: user.referralCode,
    onboardingComplete: user.onboardingComplete,
    personalityComplete: user.personalityComplete,
  };
}

export async function getUserById(id: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}

export function toPublicUser(user: NonNullable<Awaited<ReturnType<typeof getUserById>>>) {
  const { passwordHash: _, ...publicUser } = user;
  return publicUser;
}

export async function submitPersonalityTest(
  userId: string,
  responses: Record<number, number>,
  formType: "short" | "long"
) {
  const db = getDb();
  const questions = formType === "long" ? BFI2_LONG : BFI2_SHORT;
  const scores = scoreBFI2(responses, questions);
  const encrypted = encryptScores(scores);
  const profile = buildCommunicationProfile(scores);

  await db.insert(personalityAssessments).values({
    userId,
    formType,
    responses,
  });

  await db
    .insert(personalityScores)
    .values({
      userId,
      encryptedScores: encrypted,
      ...scores,
    })
    .onConflictDoUpdate({
      target: personalityScores.userId,
      set: { encryptedScores: encrypted, ...scores, updatedAt: new Date() },
    });

  await db
    .insert(communicationProfiles)
    .values({
      userId,
      styleSummary: profile.styleSummary,
      systemPromptAddendum: profile.systemPromptAddendum,
      preferences: profile.preferences,
    })
    .onConflictDoUpdate({
      target: communicationProfiles.userId,
      set: {
        styleSummary: profile.styleSummary,
        systemPromptAddendum: profile.systemPromptAddendum,
        preferences: profile.preferences,
        updatedAt: new Date(),
      },
    });

  await db
    .update(users)
    .set({ personalityComplete: true, onboardingComplete: true, updatedAt: new Date() })
    .where(eq(users.id, userId));

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  let avatar = null;
  if (user?.tier === "PRO" || formType === "short") {
    avatar = await generateUserAvatar(userId, scores);
  }

  await completeQuest(userId, "personality_complete");
  await checkAndAwardBadges(userId);

  return { scores, profile, avatar };
}

export async function generateUserAvatar(userId: string, scores?: { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number }) {
  const db = getDb();

  if (!scores) {
    const [ps] = await db.select().from(personalityScores).where(eq(personalityScores.userId, userId)).limit(1);
    if (!ps) return null;
    scores = {
      openness: ps.openness,
      conscientiousness: ps.conscientiousness,
      extraversion: ps.extraversion,
      agreeableness: ps.agreeableness,
      neuroticism: ps.neuroticism,
    };
  }

  const params = mapTraitsToAvatarParams(scores);
  const platformConfig = await getPlatformConfig();
  let imageUrl = await generateAvatarImage(params.prompt, platformConfig.replicateApiToken ?? undefined);
  if (!imageUrl) {
    imageUrl = getPlaceholderAvatarUrl(params);
  }

  const [avatar] = await db
    .insert(avatars)
    .values({ userId, imageUrl, visualParams: params })
    .onConflictDoUpdate({
      target: avatars.userId,
      set: { imageUrl, visualParams: params, updatedAt: new Date() },
    })
    .returning();

  return avatar;
}

export async function getPersonalityProfile(userId: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (user?.tier === "FREE") {
    return { profile: getNeutralProfile(), scores: null, tier: "FREE" };
  }

  const [profile] = await db
    .select()
    .from(communicationProfiles)
    .where(eq(communicationProfiles.userId, userId))
    .limit(1);

  const [scores] = await db
    .select({
      openness: personalityScores.openness,
      conscientiousness: personalityScores.conscientiousness,
      extraversion: personalityScores.extraversion,
      agreeableness: personalityScores.agreeableness,
      neuroticism: personalityScores.neuroticism,
    })
    .from(personalityScores)
    .where(eq(personalityScores.userId, userId))
    .limit(1);

  return { profile: profile || getNeutralProfile(), scores, tier: user?.tier };
}

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

export async function getAffiliateDashboard(userId: string) {
  const db = getDb();
  const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.userId, userId)).limit(1);

  if (!affiliate) return null;

  const recentCommissions = await db
    .select()
    .from(commissions)
    .where(eq(commissions.affiliateId, affiliate.id))
    .orderBy(desc(commissions.createdAt))
    .limit(20);

  const progress = getNextRankProgress(
    affiliate.rank as "EXPLORER" | "BUILDER" | "INNOVATOR" | "VISIONARY" | "MASTERMIND" | "ELITE_MASTERMIND",
    affiliate.personallySponsoredCount,
    Number(affiliate.groupVolume)
  );

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  return {
    affiliate,
    recentCommissions,
    progress,
    referralLink: `${getAppUrl()}/signup?ref=${user?.referralCode}`,
  };
}

export async function enrollUserAsAffiliate(userId: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.tier !== "PRO") throw new Error("Pro subscription required");

  const [existing] = await db.select().from(affiliates).where(eq(affiliates.userId, userId)).limit(1);
  if (existing) return existing;

  const affiliateId = await enrollAffiliate(userId, user.referredById || undefined);
  const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.id, affiliateId)).limit(1);
  return affiliate;
}

export async function getGamificationStats(userId: string) {
  const db = getDb();
  const [xp] = await db.select().from(userXp).where(eq(userXp.userId, userId)).limit(1);
  const [streak] = await db.select().from(streaks).where(eq(streaks.userId, userId)).limit(1);
  const earnedBadges = await db
    .select({ badge: badges })
    .from(userBadges)
    .innerJoin(badges, eq(userBadges.badgeId, badges.id))
    .where(eq(userBadges.userId, userId));
  const dailyQuests = await getDailyQuests(userId);

  return { xp, streak, badges: earnedBadges.map((b) => b.badge), dailyQuests };
}

export async function getAvatarBoutique(userId: string) {
  const db = getDb();
  const items = await db.select().from(avatarItems).where(eq(avatarItems.isActive, true));
  const owned = await db.select().from(userAvatarItems).where(eq(userAvatarItems.userId, userId));
  const ownedIds = new Set(owned.map((o) => o.itemId));

  return items.map((item) => ({ ...item, owned: ownedIds.has(item.id) }));
}

export async function getUserAvatar(userId: string) {
  const db = getDb();
  const [avatar] = await db.select().from(avatars).where(eq(avatars.userId, userId)).limit(1);
  return avatar;
}

export async function saveApiKey(userId: string, provider: "OPENAI" | "ANTHROPIC" | "GOOGLE" | "COHERE", key: string, label?: string) {
  const db = getDb();
  const encrypted = encryptApiKey(key);
  await db.insert(userApiKeys).values({ userId, provider, encryptedKey: encrypted, label });
}

export async function logNexusRequest(userId: string, provider: "OPENAI" | "ANTHROPIC" | "GOOGLE" | "COHERE", model: string, usedCredits: boolean, usedByok: boolean) {
  const db = getDb();
  await db.insert(nexusRequests).values({ userId, provider, model, usedCredits, usedByok });
}

export async function getIncomeDisclosures() {
  const db = getDb();
  return db.select().from(incomeDisclosures).orderBy(desc(incomeDisclosures.quarter));
}

export async function recordChatActivity(userId: string) {
  await updateStreak(userId);
  await awardXp(userId, 5);
  await completeQuest(userId, "daily_chat");
}

export {
  reminders,
  habits,
  mealPlans,
  spendingEntries,
  avatarEvolutionEvents,
  dailyMessageCounts,
};
