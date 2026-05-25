export type Rank = "EXPLORER" | "BUILDER" | "INNOVATOR" | "VISIONARY" | "MASTERMIND" | "ELITE_MASTERMIND";

export type RankConfig = {
  rank: Rank;
  levelsPaid: number;
  levelPercentages: number[];
  minPersonalSponsored: number;
  minGroupVolume: number;
  specialRequirement?: string;
};

export const RANK_CONFIGS: RankConfig[] = [
  { rank: "EXPLORER", levelsPaid: 1, levelPercentages: [5], minPersonalSponsored: 0, minGroupVolume: 0 },
  { rank: "BUILDER", levelsPaid: 3, levelPercentages: [5, 3, 2], minPersonalSponsored: 2, minGroupVolume: 100 },
  { rank: "INNOVATOR", levelsPaid: 5, levelPercentages: [5, 4, 3, 2, 1], minPersonalSponsored: 4, minGroupVolume: 500 },
  { rank: "VISIONARY", levelsPaid: 7, levelPercentages: [5, 4, 4, 3, 2, 1, 1], minPersonalSponsored: 8, minGroupVolume: 2000 },
  { rank: "MASTERMIND", levelsPaid: 9, levelPercentages: [5, 4, 4, 3, 3, 2, 2, 1, 1], minPersonalSponsored: 12, minGroupVolume: 10000, specialRequirement: "innovator_in_two_legs" },
  { rank: "ELITE_MASTERMIND", levelsPaid: 9, levelPercentages: [5, 4, 4, 3, 3, 2, 2, 1, 1], minPersonalSponsored: 12, minGroupVolume: 10000 },
];

export const TIER_PRICES: Record<string, number> = {
  PLUS: 19,
  PRO: 49,
};

export const COMMISSION_RATES = {
  FAST_START: 0.30,
  RESIDUAL_PERSONAL: 0.20,
  CREDIT_PURCHASE: 0.10,
  BOUTIQUE: 0.10,
  RETAIL_BONUS_POOL: 0.02,
};

export const LEADERSHIP_MATCH: Record<string, number[]> = {
  VISIONARY: [0.15],
  MASTERMIND: [0.20, 0.10],
  ELITE_MASTERMIND: [0.25, 0.15, 0.05],
};

export const MONTHLY_QUALIFIERS = {
  minPersonalVolume: 50,
  requiredTier: "PRO" as const,
  proPersonalVolume: 49,
};

export function calculateComplianceMultiplier(retailRatio: number): number {
  if (retailRatio >= 0.70) return 1.0;
  return Math.max(0.5, retailRatio / 0.70);
}

export function determineRank(
  personalSponsored: number,
  groupVolume: number,
  currentRank: Rank
): Rank {
  let newRank: Rank = "EXPLORER";

  for (const config of RANK_CONFIGS) {
    if (
      personalSponsored >= config.minPersonalSponsored &&
      groupVolume >= config.minGroupVolume
    ) {
      newRank = config.rank;
    }
  }

  const rankOrder: Rank[] = ["EXPLORER", "BUILDER", "INNOVATOR", "VISIONARY", "MASTERMIND", "ELITE_MASTERMIND"];
  const currentIdx = rankOrder.indexOf(currentRank);
  const newIdx = rankOrder.indexOf(newRank);

  return newIdx >= currentIdx ? newRank : currentRank;
}

export function getRankConfig(rank: Rank): RankConfig {
  return RANK_CONFIGS.find((c) => c.rank === rank) || RANK_CONFIGS[0]!;
}

export function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "ELY-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export type CommissionEntry = {
  affiliateId: string;
  type: string;
  amount: number;
  sourceUserId?: string;
  level?: number;
  periodMonth: string;
};

export function calculateFastStart(subscriptionAmount: number): number {
  return subscriptionAmount * COMMISSION_RATES.FAST_START;
}

export function calculateResidualPersonal(subscriptionAmount: number): number {
  return subscriptionAmount * COMMISSION_RATES.RESIDUAL_PERSONAL;
}

export function calculateUnilevelCommission(
  subscriptionAmount: number,
  level: number,
  rank: Rank
): number {
  const config = getRankConfig(rank);
  if (level > config.levelsPaid || level < 1) return 0;
  const pct = config.levelPercentages[level - 1] || 0;
  return subscriptionAmount * (pct / 100);
}

export function calculateLeadershipMatch(
  teamCommission: number,
  rank: Rank,
  generation: number
): number {
  const rates = LEADERSHIP_MATCH[rank];
  if (!rates || generation >= rates.length) return 0;
  return teamCommission * (rates[generation] || 0);
}

export function calculateRetailBonusShare(
  poolTotal: number,
  qualifiedAffiliates: number
): number {
  if (qualifiedAffiliates === 0) return 0;
  return poolTotal / qualifiedAffiliates;
}

export function getNextRankProgress(
  rank: Rank,
  personalSponsored: number,
  groupVolume: number
): { nextRank: Rank | null; sponsoredNeeded: number; gvNeeded: number; progress: number } {
  const rankOrder: Rank[] = ["EXPLORER", "BUILDER", "INNOVATOR", "VISIONARY", "MASTERMIND", "ELITE_MASTERMIND"];
  const currentIdx = rankOrder.indexOf(rank);

  if (currentIdx >= rankOrder.length - 1) {
    return { nextRank: null, sponsoredNeeded: 0, gvNeeded: 0, progress: 100 };
  }

  const nextRank = rankOrder[currentIdx + 1]!;
  const config = getRankConfig(nextRank);

  const sponsoredNeeded = Math.max(0, config.minPersonalSponsored - personalSponsored);
  const gvNeeded = Math.max(0, config.minGroupVolume - groupVolume);

  const sponsoredProgress = config.minPersonalSponsored > 0
    ? Math.min(100, (personalSponsored / config.minPersonalSponsored) * 100)
    : 100;
  const gvProgress = config.minGroupVolume > 0
    ? Math.min(100, (groupVolume / config.minGroupVolume) * 100)
    : 100;

  const progress = Math.round((sponsoredProgress + gvProgress) / 2);

  return { nextRank, sponsoredNeeded, gvNeeded, progress };
}
