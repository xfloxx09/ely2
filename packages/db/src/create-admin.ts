import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, closeDb, users, elyCredits, userXp, streaks } from "./index.js";

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "ELY-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const email = process.env.ADMIN_EMAIL || "admin@ely.ai";
const password = process.env.ADMIN_PASSWORD || "ElyAdmin2026!";
const name = process.env.ADMIN_NAME || "ELY Admin";

async function main() {
  const db = getDb();
  const hash = await bcrypt.hash(password, 12);

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing) {
    await db
      .update(users)
      .set({
        passwordHash: hash,
        role: "ADMIN",
        tier: "PRO",
        name,
        onboardingComplete: true,
        personalityComplete: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));

    console.log("Updated existing user to admin:", email);
  } else {
    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash: hash,
        name,
        role: "ADMIN",
        tier: "PRO",
        referralCode: generateReferralCode(),
        onboardingComplete: true,
        personalityComplete: true,
      })
      .returning();

    if (user) {
      await db.insert(elyCredits).values({ userId: user.id, balance: 1000, monthlyAllowance: 100 });
      await db.insert(userXp).values({ userId: user.id, totalXp: 500, level: 5 });
      await db.insert(streaks).values({ userId: user.id, currentStreak: 1, longestStreak: 1 });
    }

    console.log("Created admin user:", email);
  }

  console.log("\nLogin credentials:");
  console.log("  Email:", email);
  console.log("  Password:", password);
  console.log("\nAccess admin at: /admin after logging in at /login");

  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
