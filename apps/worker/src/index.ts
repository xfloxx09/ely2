import cron from "node-cron";
import { eq, sql } from "drizzle-orm";
import { getDb, closeDb, personalityMirrorReports, conversations, taskExecutions, users } from "@ely/db";
import { runMonthlyCommissions, updateAffiliateRanks } from "@ely/mlm";
import { generateMirrorReport } from "@ely/gamification";

console.log("ELY Worker starting...");

cron.schedule("0 0 1 * *", async () => {
  const periodMonth = new Date().toISOString().slice(0, 7);
  console.log(`Running monthly commissions for ${periodMonth}...`);
  try {
    const runId = await runMonthlyCommissions(periodMonth);
    console.log(`Commission run completed: ${runId}`);
    await updateAffiliateRanks();
    console.log("Rank updates completed");
  } catch (err) {
    console.error("Commission run failed:", err);
  }
});

cron.schedule("0 0 * * *", async () => {
  console.log("Running daily maintenance...");
  try {
    await updateAffiliateRanks();
  } catch (err) {
    console.error("Daily maintenance failed:", err);
  }
});

cron.schedule("0 0 1 * *", async () => {
  const month = new Date().toISOString().slice(0, 7);
  console.log(`Generating personality mirror reports for ${month}...`);
  const db = getDb();

  try {
    const allUsers = await db.select({ id: users.id }).from(users).where(eq(users.personalityComplete, true));

    for (const user of allUsers) {
      const [msgCount] = await db
        .select({ c: sql<number>`count(*)` })
        .from(conversations)
        .where(eq(conversations.userId, user.id));

      const modules = await db
        .select({ module: taskExecutions.module, c: sql<number>`count(*)` })
        .from(taskExecutions)
        .where(eq(taskExecutions.userId, user.id))
        .groupBy(taskExecutions.module);

      const topModules = modules
        .sort((a, b) => Number(b.c) - Number(a.c))
        .slice(0, 3)
        .map((m) => m.module);

      const summary = await generateMirrorReport(user.id, month, Number(msgCount?.c || 0), topModules);

      await db.insert(personalityMirrorReports).values({
        userId: user.id,
        month,
        summary,
        insights: [{ type: "monthly", data: topModules }],
      });
    }

    console.log("Mirror reports generated");
  } catch (err) {
    console.error("Mirror report generation failed:", err);
  }
});

console.log("ELY Worker scheduled jobs active");

process.on("SIGTERM", async () => {
  await closeDb();
  process.exit(0);
});
