import { eq, and, sql } from "drizzle-orm";
import {
  getDb,
  userXp,
  streaks,
  userQuests,
  quests,
  badges,
  userBadges,
  taskExecutions,
  conversations,
  nexusRequests,
} from "@ely/db";

export function xpForLevel(level: number): number {
  return level * 100;
}

export function levelFromXp(totalXp: number): number {
  let level = 1;
  let needed = xpForLevel(level);
  while (totalXp >= needed) {
    level++;
    needed += xpForLevel(level);
  }
  return level;
}

export async function awardXp(userId: string, amount: number): Promise<{ newXp: number; newLevel: number; leveledUp: boolean }> {
  const db = getDb();

  const [existing] = await db.select().from(userXp).where(eq(userXp.userId, userId)).limit(1);

  const currentXp = existing?.totalXp || 0;
  const currentLevel = existing?.level || 1;
  const newXp = currentXp + amount;
  const newLevel = levelFromXp(newXp);

  if (existing) {
    await db.update(userXp).set({ totalXp: newXp, level: newLevel, updatedAt: new Date() }).where(eq(userXp.userId, userId));
  } else {
    await db.insert(userXp).values({ userId, totalXp: newXp, level: newLevel });
  }

  return { newXp, newLevel, leveledUp: newLevel > currentLevel };
}

export async function updateStreak(userId: string): Promise<{ currentStreak: number; longestStreak: number }> {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const [existing] = await db.select().from(streaks).where(eq(streaks.userId, userId)).limit(1);

  if (!existing) {
    await db.insert(streaks).values({ userId, currentStreak: 1, longestStreak: 1, lastActiveDate: today });
    return { currentStreak: 1, longestStreak: 1 };
  }

  if (existing.lastActiveDate === today) {
    return { currentStreak: existing.currentStreak, longestStreak: existing.longestStreak };
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let newStreak: number;

  if (existing.lastActiveDate === yesterday) {
    newStreak = existing.currentStreak + 1;
  } else if (existing.streakFreezes > 0) {
    newStreak = existing.currentStreak;
    await db.update(streaks).set({ streakFreezes: existing.streakFreezes - 1 }).where(eq(streaks.userId, userId));
  } else {
    newStreak = 1;
  }

  const longestStreak = Math.max(existing.longestStreak, newStreak);

  await db.update(streaks).set({
    currentStreak: newStreak,
    longestStreak,
    lastActiveDate: today,
    updatedAt: new Date(),
  }).where(eq(streaks.userId, userId));

  return { currentStreak: newStreak, longestStreak };
}

export async function completeQuest(userId: string, actionKey: string): Promise<{ completed: boolean; xpAwarded: number }> {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const [quest] = await db
    .select()
    .from(quests)
    .where(and(eq(quests.actionKey, actionKey), eq(quests.isActive, true)))
    .limit(1);

  if (!quest) return { completed: false, xpAwarded: 0 };

  const [existing] = await db
    .select()
    .from(userQuests)
    .where(and(eq(userQuests.userId, userId), eq(userQuests.questId, quest.id), eq(userQuests.questDate, today)))
    .limit(1);

  if (existing?.completedAt) return { completed: false, xpAwarded: 0 };

  await db.insert(userQuests).values({
    userId,
    questId: quest.id,
    questDate: today,
    completedAt: new Date(),
  });

  await awardXp(userId, quest.xpReward);
  return { completed: true, xpAwarded: quest.xpReward };
}

export async function checkAndAwardBadges(userId: string): Promise<string[]> {
  const db = getDb();
  const awarded: string[] = [];

  const allBadges = await db.select().from(badges);
  const earned = await db.select().from(userBadges).where(eq(userBadges.userId, userId));
  const earnedIds = new Set(earned.map((b) => b.badgeId));

  for (const badge of allBadges) {
    if (earnedIds.has(badge.id)) continue;

    let value = 0;
    switch (badge.criteriaKey) {
      case "conversations": {
        const [count] = await db.select({ c: sql<number>`count(*)` }).from(conversations).where(eq(conversations.userId, userId));
        value = Number(count?.c || 0);
        break;
      }
      case "kitchen_tasks": {
        const [count] = await db.select({ c: sql<number>`count(*)` }).from(taskExecutions).where(and(eq(taskExecutions.userId, userId), eq(taskExecutions.module, "KITCHEN_BRAIN")));
        value = Number(count?.c || 0);
        break;
      }
      case "nexus_models": {
        const [count] = await db.select({ c: sql<number>`count(distinct ${nexusRequests.model})` }).from(nexusRequests).where(eq(nexusRequests.userId, userId));
        value = Number(count?.c || 0);
        break;
      }
      case "streak": {
        const [s] = await db.select().from(streaks).where(eq(streaks.userId, userId)).limit(1);
        value = s?.longestStreak || 0;
        break;
      }
      case "personality_complete":
        value = 1;
        break;
    }

    if (value >= badge.criteriaValue) {
      await db.insert(userBadges).values({ userId, badgeId: badge.id });
      awarded.push(badge.name);
    }
  }

  return awarded;
}

export async function getDailyQuests(userId: string) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const dailyQuests = await db.select().from(quests).where(and(eq(quests.type, "DAILY"), eq(quests.isActive, true)));

  const completed = await db
    .select()
    .from(userQuests)
    .where(and(eq(userQuests.userId, userId), eq(userQuests.questDate, today)));

  const completedIds = new Set(completed.filter((q) => q.completedAt).map((q) => q.questId));

  return dailyQuests.map((q) => ({
    ...q,
    completed: completedIds.has(q.id),
  }));
}

export async function generateMirrorReport(
  userId: string,
  month: string,
  messageCount: number,
  topModules: string[]
): Promise<string> {
  const insights = [
    `You had ${messageCount} conversations with ELY this month.`,
    topModules.length > 0 ? `Your most-used modules: ${topModules.join(", ")}.` : "Explore more ELY modules to unlock insights.",
    "Your communication patterns show growing trust and engagement with your AI companion.",
  ];

  return insights.join(" ");
}
