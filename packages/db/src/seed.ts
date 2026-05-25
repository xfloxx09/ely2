import { getDb, closeDb } from "./index.js";
import {
  quests,
  badges,
  avatarItems,
  teamChallenges,
} from "./schema/index.js";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  await db.insert(quests).values([
    {
      title: "Plan Your Day",
      description: "Have ELY plan your meals for today",
      type: "DAILY",
      xpReward: 15,
      module: "KITCHEN_BRAIN",
      actionKey: "plan_meals",
    },
    {
      title: "Difficult Message",
      description: "Use ELY to draft a difficult message",
      type: "DAILY",
      xpReward: 15,
      module: "SCRIBE",
      actionKey: "draft_message",
    },
    {
      title: "Morning Check-in",
      description: "Start your day with a chat with ELY",
      type: "DAILY",
      xpReward: 10,
      actionKey: "daily_chat",
    },
    {
      title: "Research Deep Dive",
      description: "Ask ELY to research a topic for you",
      type: "DAILY",
      xpReward: 20,
      module: "RESEARCHER",
      actionKey: "research_topic",
    },
    {
      title: "Habit Check",
      description: "Review your habits with ELY",
      type: "DAILY",
      xpReward: 15,
      module: "HABIT_ARCHITECT",
      actionKey: "check_habits",
    },
  ]).onConflictDoNothing();

  await db.insert(badges).values([
    { name: "First Chat", description: "Started your first conversation", icon: "💬", category: "PRODUCT", criteriaKey: "conversations", criteriaValue: 1 },
    { name: "100 Dinners Planned", description: "Planned 100 meals", icon: "🍽️", category: "PRODUCT", criteriaKey: "kitchen_tasks", criteriaValue: 100 },
    { name: "Time Lord", description: "50 hours saved with ELY", icon: "⏰", category: "PRODUCT", criteriaKey: "hours_saved", criteriaValue: 50 },
    { name: "Model Collector", description: "Used 5 different Nexus models", icon: "🤖", category: "PRODUCT", criteriaKey: "nexus_models", criteriaValue: 5 },
    { name: "7-Day Streak", description: "7 consecutive days chatting", icon: "🔥", category: "PRODUCT", criteriaKey: "streak", criteriaValue: 7 },
    { name: "Connector", description: "10 personal sponsors", icon: "🔗", category: "BUILDER", criteriaKey: "personal_sponsors", criteriaValue: 10 },
    { name: "Revenue Rocket", description: "$1k personal commissions", icon: "🚀", category: "BUILDER", criteriaKey: "personal_commissions", criteriaValue: 1000 },
    { name: "Talent Scout", description: "Helped 3 affiliates reach Builder", icon: "🎯", category: "BUILDER", criteriaKey: "builder_helps", criteriaValue: 3 },
    { name: "Soul Seeker", description: "20 retail customers completed personality profile", icon: "✨", category: "BUILDER", criteriaKey: "retail_personality", criteriaValue: 20 },
    { name: "Personality Pioneer", description: "Completed the BFI-2 assessment", icon: "🧠", category: "PERSONALITY", criteriaKey: "personality_complete", criteriaValue: 1 },
  ]).onConflictDoNothing();

  await db.insert(avatarItems).values([
    { name: "Cosmic Background", description: "Abstract starfield backdrop", type: "ENVIRONMENT", priceCents: 499, xpCost: 500 },
    { name: "Golden Halo", description: "Radiant golden accessory", type: "ACCESSORY", priceCents: 299, xpCost: 300 },
    { name: "Executive Suit", description: "Professional outfit", type: "OUTFIT", priceCents: 799 },
    { name: "Knowing Smile", description: "Unlock a knowing micro-expression", type: "EXPRESSION", xpCost: 1000 },
    { name: "Zen Garden", description: "Calm nature environment", type: "ENVIRONMENT", priceCents: 599, xpCost: 600 },
  ]).onConflictDoNothing();

  await db.insert(teamChallenges).values([
    {
      name: "Genesis Sprint",
      description: "First teams to reach $5,000 GV win VIP prizes",
      targetGv: "5000",
      prize: "VIP Retreat + Tech Prize",
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
  ]).onConflictDoNothing();

  console.log("Seed complete.");
  await closeDb();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
