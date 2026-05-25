import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  getDb,
  closeDb,
  users,
  elyCredits,
  userXp,
  streaks,
  personalityScores,
  communicationProfiles,
  avatars,
  personalityAssessments,
} from "./index.js";
import {
  encryptScores,
  buildCommunicationProfile,
  mapTraitsToAvatarParams,
  type TraitScores,
} from "@ely/personality";
import { getPlaceholderAvatarUrl } from "@ely/ai";

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || "DemoEly2026!";

type DemoPersona = {
  email: string;
  name: string;
  scores: TraitScores;
  xp: number;
  level: number;
  streak: number;
  avatarColor: string;
  bio: string;
};

const DEMO_PERSONAS: DemoPersona[] = [
  {
    email: "maya.demo@ely.ai",
    name: "Maya Chen",
    scores: { openness: 88, conscientiousness: 52, extraversion: 78, agreeableness: 70, neuroticism: 35 },
    xp: 1240,
    level: 8,
    streak: 12,
    avatarColor: "8b5cf6",
    bio: "Creative explorer who loves metaphors, art, and bold ideas.",
  },
  {
    email: "marcus.demo@ely.ai",
    name: "Marcus Webb",
    scores: { openness: 45, conscientiousness: 92, extraversion: 55, agreeableness: 60, neuroticism: 28 },
    xp: 980,
    level: 7,
    streak: 21,
    avatarColor: "3b82f6",
    bio: "Organized planner — structured, reliable, loves checklists and clear next steps.",
  },
  {
    email: "luna.demo@ely.ai",
    name: "Luna Rivera",
    scores: { openness: 62, conscientiousness: 58, extraversion: 48, agreeableness: 95, neuroticism: 55 },
    xp: 760,
    level: 6,
    streak: 9,
    avatarColor: "ec4899",
    bio: "Warm and empathetic — validates feelings first, gentle and supportive.",
  },
  {
    email: "kai.demo@ely.ai",
    name: "Kai Okonkwo",
    scores: { openness: 55, conscientiousness: 50, extraversion: 90, agreeableness: 72, neuroticism: 40 },
    xp: 1520,
    level: 9,
    streak: 5,
    avatarColor: "f97316",
    bio: "High-energy connector — enthusiastic, social, lifts the room.",
  },
  {
    email: "sage.demo@ely.ai",
    name: "Sage Whitmore",
    scores: { openness: 85, conscientiousness: 68, extraversion: 25, agreeableness: 65, neuroticism: 42 },
    xp: 540,
    level: 5,
    streak: 16,
    avatarColor: "14b8a6",
    bio: "Quiet philosopher — thoughtful, deep, prefers calm precise conversation.",
  },
];

function loadRootEnv() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  for (const file of [".env", "apps/web/.env.local"]) {
    const path = resolve(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "ELY-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function placeholderFor(name: string, color: string): string {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${color}&color=fff&size=256&bold=true&font-size=0.45`;
}

async function upsertDemoUser(persona: DemoPersona, passwordHash: string) {
  const db = getDb();
  const profile = buildCommunicationProfile(persona.scores);
  const styleSummary = `${persona.bio} ${profile.styleSummary}`;
  const encrypted = encryptScores(persona.scores);
  const visualParams = mapTraitsToAvatarParams(persona.scores);
  const imageUrl = getPlaceholderAvatarUrl(visualParams) || placeholderFor(persona.name, persona.avatarColor);

  let [user] = await db.select().from(users).where(eq(users.email, persona.email)).limit(1);

  if (user) {
    await db
      .update(users)
      .set({
        name: persona.name,
        passwordHash,
        personalityComplete: true,
        onboardingComplete: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  } else {
    [user] = await db
      .insert(users)
      .values({
        email: persona.email,
        name: persona.name,
        passwordHash,
        referralCode: generateReferralCode(),
        personalityComplete: true,
        onboardingComplete: true,
      })
      .returning();

    if (user) {
      await db.insert(elyCredits).values({ userId: user.id, balance: 0, monthlyAllowance: 0 });
      await db.insert(personalityAssessments).values({
        userId: user.id,
        formType: "short",
        responses: {},
      });
    }
  }

  if (!user) throw new Error(`Failed to create ${persona.email}`);

  await db
    .insert(personalityScores)
    .values({
      userId: user.id,
      encryptedScores: encrypted,
      ...persona.scores,
    })
    .onConflictDoUpdate({
      target: personalityScores.userId,
      set: { encryptedScores: encrypted, ...persona.scores, updatedAt: new Date() },
    });

  await db
    .insert(communicationProfiles)
    .values({
      userId: user.id,
      styleSummary,
      systemPromptAddendum: profile.systemPromptAddendum,
      preferences: { ...profile.preferences, demoBio: persona.bio },
    })
    .onConflictDoUpdate({
      target: communicationProfiles.userId,
      set: {
        styleSummary,
        systemPromptAddendum: profile.systemPromptAddendum,
        preferences: { ...profile.preferences, demoBio: persona.bio },
        updatedAt: new Date(),
      },
    });

  await db
    .insert(avatars)
    .values({
      userId: user.id,
      imageUrl,
      visualParams,
      evolutionLevel: persona.level,
    })
    .onConflictDoUpdate({
      target: avatars.userId,
      set: { imageUrl, visualParams, evolutionLevel: persona.level, updatedAt: new Date() },
    });

  await db
    .insert(userXp)
    .values({ userId: user.id, totalXp: persona.xp, level: persona.level })
    .onConflictDoUpdate({
      target: userXp.userId,
      set: { totalXp: persona.xp, level: persona.level, updatedAt: new Date() },
    });

  await db
    .insert(streaks)
    .values({
      userId: user.id,
      currentStreak: persona.streak,
      longestStreak: Math.max(persona.streak, 7),
      lastActiveDate: new Date().toISOString().slice(0, 10),
    })
    .onConflictDoUpdate({
      target: streaks.userId,
      set: {
        currentStreak: persona.streak,
        longestStreak: Math.max(persona.streak, 7),
        lastActiveDate: new Date().toISOString().slice(0, 10),
      },
    });

  return user;
}

async function main() {
  loadRootEnv();

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Point it at your Postgres (local or Railway) and retry.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const db = getDb();

  console.log("Seeding 5 demo travelers for Community testing...\n");

  for (const persona of DEMO_PERSONAS) {
    const user = await upsertDemoUser(persona, passwordHash);
    console.log(`  ✓ ${persona.name} (${persona.email}) — Lv.${persona.level}, ${persona.streak}-day streak`);
    void user;
  }

  const count = await db.select().from(users);
  console.log(`\nDone. Total users in database: ${count.length}`);
  console.log("\nAll demo accounts use the same password:");
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log("\nDemo emails:");
  for (const p of DEMO_PERSONAS) {
    console.log(`  • ${p.email}`);
  }
  console.log("\nLog in as your main account, open /community to see them.");

  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
