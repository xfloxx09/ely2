import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
  decimal,
  pgEnum,
  uniqueIndex,
  index,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const tierEnum = pgEnum("tier", ["FREE", "PLUS", "PRO"]);
export const roleEnum = pgEnum("role", ["USER", "ADMIN"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "ACTIVE",
  "CANCELED",
  "PAST_DUE",
  "TRIALING",
]);
export const rankEnum = pgEnum("rank", [
  "EXPLORER",
  "BUILDER",
  "INNOVATOR",
  "VISIONARY",
  "MASTERMIND",
  "ELITE_MASTERMIND",
]);
export const commissionTypeEnum = pgEnum("commission_type", [
  "FAST_START",
  "RESIDUAL_PERSONAL",
  "UNILEVEL",
  "LEADERSHIP_MATCH",
  "RETAIL_BONUS",
  "CREDIT_PURCHASE",
  "BOUTIQUE",
]);
export const commissionStatusEnum = pgEnum("commission_status", [
  "PENDING",
  "PAID",
  "CANCELED",
]);
export const messageRoleEnum = pgEnum("message_role", ["USER", "ASSISTANT", "SYSTEM"]);
export const taskModuleEnum = pgEnum("task_module", [
  "CONCIERGE",
  "SCRIBE",
  "KITCHEN_BRAIN",
  "HABIT_ARCHITECT",
  "RESEARCHER",
  "MONEY_SCOUT",
]);
export const questTypeEnum = pgEnum("quest_type", ["DAILY", "WEEKLY", "MILESTONE"]);
export const badgeCategoryEnum = pgEnum("badge_category", [
  "PRODUCT",
  "BUILDER",
  "PERSONALITY",
]);
export const avatarItemTypeEnum = pgEnum("avatar_item_type", [
  "OUTFIT",
  "ACCESSORY",
  "ENVIRONMENT",
  "EXPRESSION",
]);
export const nexusProviderEnum = pgEnum("nexus_provider", [
  "OPENAI",
  "ANTHROPIC",
  "GOOGLE",
  "COHERE",
]);

export const socialConversationTypeEnum = pgEnum("social_conversation_type", [
  "DIRECT",
  "AI_PERSONA",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified"),
  passwordHash: text("password_hash"),
  name: text("name"),
  image: text("image"),
  tier: tierEnum("tier").notNull().default("FREE"),
  role: roleEnum("role").notNull().default("USER"),
  referralCode: text("referral_code").notNull().unique(),
  referredById: uuid("referred_by_id"),
  stripeCustomerId: text("stripe_customer_id"),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  personalityComplete: boolean("personality_complete").notNull().default(false),
  customInstructions: text("custom_instructions"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionToken: text("session_token").notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires").notNull(),
});

export const personalityAssessments = pgTable("personality_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  formType: text("form_type").notNull(), // short | long
  responses: jsonb("responses").notNull(),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

export const personalityScores = pgTable("personality_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  encryptedScores: text("encrypted_scores").notNull(),
  openness: integer("openness").notNull(),
  conscientiousness: integer("conscientiousness").notNull(),
  extraversion: integer("extraversion").notNull(),
  agreeableness: integer("agreeableness").notNull(),
  neuroticism: integer("neuroticism").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const communicationProfiles = pgTable("communication_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  styleSummary: text("style_summary").notNull(),
  systemPromptAddendum: text("system_prompt_addendum").notNull(),
  preferences: jsonb("preferences").notNull().default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const avatars = pgTable("avatars", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  imageUrl: text("image_url"),
  visualParams: jsonb("visual_params").notNull().default({}),
  evolutionLevel: integer("evolution_level").notNull().default(1),
  equippedItems: jsonb("equipped_items").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const avatarItems = pgTable("avatar_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  type: avatarItemTypeEnum("type").notNull(),
  imageUrl: text("image_url"),
  priceCents: integer("price_cents").notNull().default(0),
  xpCost: integer("xp_cost"),
  stripePriceId: text("stripe_price_id"),
  isActive: boolean("is_active").notNull().default(true),
});

export const userAvatarItems = pgTable(
  "user_avatar_items",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => avatarItems.id, { onDelete: "cascade" }),
    acquiredAt: timestamp("acquired_at").notNull().defaultNow(),
    source: text("source").notNull(), // purchase | xp | milestone
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] })]
);

export const avatarEvolutionEvents = pgTable("avatar_evolution_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  avatarId: uuid("avatar_id")
    .notNull()
    .references(() => avatars.id, { onDelete: "cascade" }),
  milestone: text("milestone").notNull(),
  description: text("description"),
  visualChanges: jsonb("visual_changes").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New Chat"),
  activeModule: taskModuleEnum("active_module"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    modelUsed: text("model_used"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId)]
);

export const memories = pgTable("memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  category: text("category"),
  importance: integer("importance").notNull().default(5),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripePriceId: text("stripe_price_id"),
  tier: tierEnum("tier").notNull(),
  status: subscriptionStatusEnum("status").notNull().default("ACTIVE"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  firstPaymentAt: timestamp("first_payment_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const elyCredits = pgTable("ely_credits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  balance: integer("balance").notNull().default(0),
  monthlyAllowance: integer("monthly_allowance").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const creditTransactions = pgTable("credit_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  type: text("type").notNull(), // purchase | usage | grant | refund
  description: text("description"),
  stripePaymentId: text("stripe_payment_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const affiliates = pgTable("affiliates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  sponsorId: uuid("sponsor_id").references((): AnyPgColumn => affiliates.id),
  rank: rankEnum("rank").notNull().default("EXPLORER"),
  isActive: boolean("is_active").notNull().default(true),
  stripeConnectId: text("stripe_connect_id"),
  stripeConnectOnboarded: boolean("stripe_connect_onboarded").notNull().default(false),
  personalVolume: decimal("personal_volume", { precision: 10, scale: 2 }).notNull().default("0"),
  groupVolume: decimal("group_volume", { precision: 10, scale: 2 }).notNull().default("0"),
  personallySponsoredCount: integer("personally_sponsored_count").notNull().default(0),
  retailCustomerCount: integer("retail_customer_count").notNull().default(0),
  enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const genealogyClosure = pgTable(
  "genealogy_closure",
  {
    ancestorId: uuid("ancestor_id")
      .notNull()
      .references(() => affiliates.id, { onDelete: "cascade" }),
    descendantId: uuid("descendant_id")
      .notNull()
      .references(() => affiliates.id, { onDelete: "cascade" }),
    depth: integer("depth").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.ancestorId, t.descendantId] }),
    index("genealogy_descendant_idx").on(t.descendantId),
    index("genealogy_depth_idx").on(t.depth),
  ]
);

export const rankQualifications = pgTable("rank_qualifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  affiliateId: uuid("affiliate_id")
    .notNull()
    .references(() => affiliates.id, { onDelete: "cascade" }),
  rank: rankEnum("rank").notNull(),
  qualifiedAt: timestamp("qualified_at").notNull().defaultNow(),
  periodMonth: text("period_month").notNull(),
  personalSponsored: integer("personal_sponsored").notNull(),
  groupVolume: decimal("group_volume", { precision: 10, scale: 2 }).notNull(),
});

export const commissionRuns = pgTable("commission_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  periodMonth: text("period_month").notNull(),
  status: text("status").notNull().default("pending"),
  totalPaid: decimal("total_paid", { precision: 12, scale: 2 }).notNull().default("0"),
  complianceMultiplier: decimal("compliance_multiplier", { precision: 4, scale: 2 })
    .notNull()
    .default("1"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const commissions = pgTable("commissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  affiliateId: uuid("affiliate_id")
    .notNull()
    .references(() => affiliates.id, { onDelete: "cascade" }),
  runId: uuid("run_id").references(() => commissionRuns.id),
  type: commissionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  sourceUserId: uuid("source_user_id").references(() => users.id),
  level: integer("level"),
  status: commissionStatusEnum("status").notNull().default("PENDING"),
  periodMonth: text("period_month").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const retailBonusPool = pgTable("retail_bonus_pool", {
  id: uuid("id").primaryKey().defaultRandom(),
  quarter: text("quarter").notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  distributedAmount: decimal("distributed_amount", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const complianceSnapshots = pgTable("compliance_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  periodMonth: text("period_month").notNull().unique(),
  totalCommissions: decimal("total_commissions", { precision: 12, scale: 2 }).notNull(),
  retailCommissions: decimal("retail_commissions", { precision: 12, scale: 2 }).notNull(),
  retailRatio: decimal("retail_ratio", { precision: 5, scale: 4 }).notNull(),
  multiplierApplied: decimal("multiplier_applied", { precision: 4, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userXp = pgTable("user_xp", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  totalXp: integer("total_xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const quests = pgTable("quests", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: questTypeEnum("type").notNull(),
  xpReward: integer("xp_reward").notNull().default(10),
  module: taskModuleEnum("module"),
  actionKey: text("action_key").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const userQuests = pgTable(
  "user_quests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questId: uuid("quest_id")
      .notNull()
      .references(() => quests.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at"),
    questDate: text("quest_date").notNull(),
  },
  (t) => [uniqueIndex("user_quest_date_idx").on(t.userId, t.questId, t.questDate)]
);

export const streaks = pgTable("streaks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActiveDate: text("last_active_date"),
  streakFreezes: integer("streak_freezes").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const badges = pgTable("badges", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  category: badgeCategoryEnum("category").notNull(),
  criteriaKey: text("criteria_key").notNull().unique(),
  criteriaValue: integer("criteria_value").notNull().default(1),
});

export const userBadges = pgTable(
  "user_badges",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    badgeId: uuid("badge_id")
      .notNull()
      .references(() => badges.id, { onDelete: "cascade" }),
    earnedAt: timestamp("earned_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.badgeId] })]
);

export const teamChallenges = pgTable("team_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  targetGv: decimal("target_gv", { precision: 10, scale: 2 }).notNull(),
  prize: text("prize"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const teamChallengeProgress = pgTable("team_challenge_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  challengeId: uuid("challenge_id")
    .notNull()
    .references(() => teamChallenges.id, { onDelete: "cascade" }),
  affiliateId: uuid("affiliate_id")
    .notNull()
    .references(() => affiliates.id, { onDelete: "cascade" }),
  currentGv: decimal("current_gv", { precision: 10, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const taskExecutions = pgTable("task_executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  module: taskModuleEnum("module").notNull(),
  input: text("input"),
  output: text("output"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reminders = pgTable("reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  dueAt: timestamp("due_at").notNull(),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const habits = pgTable("habits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  frequency: text("frequency").notNull().default("daily"),
  streak: integer("streak").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const mealPlans = pgTable("meal_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  meals: jsonb("meals").notNull().default([]),
  shoppingList: jsonb("shopping_list").notNull().default([]),
  dietaryPrefs: jsonb("dietary_prefs").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userApiKeys = pgTable("user_api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: nexusProviderEnum("provider").notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  label: text("label"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const nexusRequests = pgTable("nexus_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: nexusProviderEnum("provider").notNull(),
  model: text("model").notNull(),
  usedCredits: boolean("used_credits").notNull().default(false),
  usedByok: boolean("used_byok").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const modelUsageLogs = pgTable("model_usage_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  tokensUsed: integer("tokens_used"),
  source: text("source").notNull(), // ely_core | nexus
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const incomeDisclosures = pgTable("income_disclosures", {
  id: uuid("id").primaryKey().defaultRandom(),
  quarter: text("quarter").notNull(),
  rank: rankEnum("rank").notNull(),
  averageEarnings: decimal("average_earnings", { precision: 10, scale: 2 }).notNull(),
  medianEarnings: decimal("median_earnings", { precision: 10, scale: 2 }).notNull(),
  activeAffiliates: integer("active_affiliates").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const dailyMessageCounts = pgTable(
  "daily_message_counts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })]
);

export const personalityMirrorReports = pgTable("personality_mirror_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  month: text("month").notNull(),
  summary: text("summary").notNull(),
  insights: jsonb("insights").notNull().default([]),
  shareable: boolean("shareable").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  isSecret: boolean("is_secret").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

export const socialConversations = pgTable(
  "social_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: socialConversationTypeEnum("type").notNull(),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    participantIds: jsonb("participant_ids").notNull().default([]),
    title: text("title").notNull().default("Conversation"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("social_conversations_created_by_idx").on(t.createdById)]
);

export const socialMessages = pgTable(
  "social_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => socialConversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => users.id, { onDelete: "set null" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("social_messages_conversation_idx").on(t.conversationId)]
);

export const spendingEntries = pgTable("spending_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  date: text("date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
