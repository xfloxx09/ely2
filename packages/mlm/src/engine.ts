import { eq, and, sql } from "drizzle-orm";
import { getDb, affiliates, genealogyClosure, commissions, commissionRuns, complianceSnapshots, users, subscriptions } from "@ely/db";
import {
  calculateFastStart,
  calculateResidualPersonal,
  calculateUnilevelCommission,
  calculateLeadershipMatch,
  calculateComplianceMultiplier,
  calculateRetailBonusShare,
  determineRank,
  getRankConfig,
  TIER_PRICES,
  COMMISSION_RATES,
  type CommissionEntry,
  type Rank,
} from "./config.js";

export async function enrollAffiliate(
  userId: string,
  sponsorUserId?: string
): Promise<string> {
  const db = getDb();

  let sponsorAffiliateId: string | undefined;
  if (sponsorUserId) {
    const [sponsor] = await db
      .select()
      .from(affiliates)
      .where(eq(affiliates.userId, sponsorUserId))
      .limit(1);
    sponsorAffiliateId = sponsor?.id;
  }

  const [affiliate] = await db
    .insert(affiliates)
    .values({
      userId,
      sponsorId: sponsorAffiliateId,
      rank: "EXPLORER",
    })
    .returning();

  if (!affiliate) throw new Error("Failed to create affiliate");

  await db.insert(genealogyClosure).values({
    ancestorId: affiliate.id,
    descendantId: affiliate.id,
    depth: 0,
  });

  if (sponsorAffiliateId) {
    const ancestorPaths = await db
      .select()
      .from(genealogyClosure)
      .where(eq(genealogyClosure.descendantId, sponsorAffiliateId));

    for (const path of ancestorPaths) {
      await db.insert(genealogyClosure).values({
        ancestorId: path.ancestorId,
        descendantId: affiliate.id,
        depth: path.depth + 1,
      }).onConflictDoNothing();
    }

    await db
      .update(affiliates)
      .set({
        personallySponsoredCount: sql`${affiliates.personallySponsoredCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(affiliates.id, sponsorAffiliateId));
  }

  return affiliate.id;
}

export async function runMonthlyCommissions(periodMonth: string): Promise<string> {
  const db = getDb();
  const entries: CommissionEntry[] = [];

  const [run] = await db
    .insert(commissionRuns)
    .values({ periodMonth, status: "running" })
    .returning();

  if (!run) throw new Error("Failed to create commission run");

  const activeSubs = await db
    .select({
      userId: subscriptions.userId,
      tier: subscriptions.tier,
      firstPaymentAt: subscriptions.firstPaymentAt,
    })
    .from(subscriptions)
    .where(eq(subscriptions.status, "ACTIVE"));

  let totalCommissions = 0;
  let retailCommissions = 0;

  for (const sub of activeSubs) {
    const amount = TIER_PRICES[sub.tier] || 0;
    if (amount === 0) continue;

    const [user] = await db.select().from(users).where(eq(users.id, sub.userId)).limit(1);
    if (!user?.referredById) continue;

    const [sponsorAffiliate] = await db
      .select()
      .from(affiliates)
      .where(eq(affiliates.userId, user.referredById))
      .limit(1);

    if (!sponsorAffiliate) continue;

    const isFirstMonth = sub.firstPaymentAt &&
      new Date(sub.firstPaymentAt).toISOString().slice(0, 7) === periodMonth;

    if (isFirstMonth) {
      const fastStart = calculateFastStart(amount);
      entries.push({
        affiliateId: sponsorAffiliate.id,
        type: "FAST_START",
        amount: fastStart,
        sourceUserId: sub.userId,
        periodMonth,
      });
      totalCommissions += fastStart;
    }

    const residual = calculateResidualPersonal(amount);
    entries.push({
      affiliateId: sponsorAffiliate.id,
      type: "RESIDUAL_PERSONAL",
      amount: residual,
      sourceUserId: sub.userId,
      periodMonth,
    });
    totalCommissions += residual;

    const upline = await db
      .select({
        ancestorId: genealogyClosure.ancestorId,
        depth: genealogyClosure.depth,
      })
      .from(genealogyClosure)
      .where(
        and(
          eq(genealogyClosure.descendantId, sponsorAffiliate.id),
          sql`${genealogyClosure.depth} > 0`
        )
      )
      .orderBy(genealogyClosure.depth);

    for (const node of upline) {
      const [ancestorAffiliate] = await db
        .select()
        .from(affiliates)
        .where(eq(affiliates.id, node.ancestorId))
        .limit(1);

      if (!ancestorAffiliate || !ancestorAffiliate.isActive) continue;

      const unilevel = calculateUnilevelCommission(
        amount,
        node.depth,
        ancestorAffiliate.rank as Rank
      );

      if (unilevel > 0) {
        entries.push({
          affiliateId: ancestorAffiliate.id,
          type: "UNILEVEL",
          amount: unilevel,
          sourceUserId: sub.userId,
          level: node.depth,
          periodMonth,
        });
        totalCommissions += unilevel;
      }
    }

    const [userAffiliate] = await db
      .select()
      .from(affiliates)
      .where(eq(affiliates.userId, sub.userId))
      .limit(1);

    if (!userAffiliate) {
      retailCommissions += residual;
    }
  }

  const retailRatio = totalCommissions > 0 ? retailCommissions / totalCommissions : 1;
  const multiplier = calculateComplianceMultiplier(retailRatio);

  await db.insert(complianceSnapshots).values({
    periodMonth,
    totalCommissions: String(totalCommissions),
    retailCommissions: String(retailCommissions),
    retailRatio: String(retailRatio),
    multiplierApplied: String(multiplier),
  }).onConflictDoNothing();

  let totalPaid = 0;
  for (const entry of entries) {
    const adjustedAmount = entry.amount * multiplier;
    await db.insert(commissions).values({
      affiliateId: entry.affiliateId,
      runId: run.id,
      type: entry.type as "FAST_START" | "RESIDUAL_PERSONAL" | "UNILEVEL" | "LEADERSHIP_MATCH" | "RETAIL_BONUS" | "CREDIT_PURCHASE" | "BOUTIQUE",
      amount: String(adjustedAmount),
      sourceUserId: entry.sourceUserId,
      level: entry.level,
      periodMonth: entry.periodMonth,
      status: "PENDING",
    });
    totalPaid += adjustedAmount;
  }

  await db
    .update(commissionRuns)
    .set({
      status: "completed",
      totalPaid: String(totalPaid),
      complianceMultiplier: String(multiplier),
      completedAt: new Date(),
    })
    .where(eq(commissionRuns.id, run.id));

  return run.id;
}

export async function updateAffiliateRanks(): Promise<void> {
  const db = getDb();
  const allAffiliates = await db.select().from(affiliates).where(eq(affiliates.isActive, true));

  for (const affiliate of allAffiliates) {
    const newRank = determineRank(
      affiliate.personallySponsoredCount,
      Number(affiliate.groupVolume),
      affiliate.rank as Rank
    );

    if (newRank !== affiliate.rank) {
      await db
        .update(affiliates)
        .set({ rank: newRank, updatedAt: new Date() })
        .where(eq(affiliates.id, affiliate.id));
    }
  }
}

export { enrollAffiliate as default };
