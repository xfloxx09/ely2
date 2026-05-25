import { sql } from "drizzle-orm";
import { getDb } from "./index.js";

let platformSettingsEnsured = false;

/** Creates platform_settings if missing (safe for production without manual db:push). */
export async function ensurePlatformSettingsTable(): Promise<void> {
  if (platformSettingsEnsured) return;

  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "platform_settings" (
      "key" text PRIMARY KEY NOT NULL,
      "value" text NOT NULL,
      "is_secret" boolean DEFAULT false NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      "updated_by_id" uuid REFERENCES "users"("id")
    )
  `);

  platformSettingsEnsured = true;
}

let socialTablesEnsured = false;

/** Creates social chat tables if missing. */
export async function ensureSocialTables(): Promise<void> {
  if (socialTablesEnsured) return;

  const db = getDb();
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "social_conversation_type" AS ENUM ('DIRECT', 'AI_PERSONA');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "social_conversation_type" ADD VALUE 'GROUP';
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TYPE "social_conversation_type" ADD VALUE 'GROUP_AI';
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "social_folder_kind" AS ENUM ('real', 'avatar');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "social_conversations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "type" "social_conversation_type" NOT NULL,
      "created_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "participant_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
      "title" text DEFAULT 'Conversation' NOT NULL,
      "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "social_messages" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "conversation_id" uuid NOT NULL REFERENCES "social_conversations"("id") ON DELETE cascade,
      "sender_id" uuid REFERENCES "users"("id") ON DELETE set null,
      "role" "message_role" NOT NULL,
      "content" text NOT NULL,
      "metadata" jsonb DEFAULT '{}'::jsonb,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "social_conversation_folders" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "name" text NOT NULL,
      "kind" "social_folder_kind" NOT NULL,
      "sort_order" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "social_conversation_user_prefs" (
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "conversation_id" uuid NOT NULL REFERENCES "social_conversations"("id") ON DELETE cascade,
      "folder_id" uuid REFERENCES "social_conversation_folders"("id") ON DELETE set null,
      "archived_at" timestamp,
      "deleted_at" timestamp,
      PRIMARY KEY ("user_id", "conversation_id")
    )
  `);

  socialTablesEnsured = true;
}

let storySessionTableEnsured = false;

/** Creates personality story session table for onboarding rerolls. */
export async function ensureStorySessionTable(): Promise<void> {
  if (storySessionTableEnsured) return;

  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "personality_story_sessions" (
      "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE cascade,
      "rerolls_used" integer DEFAULT 0 NOT NULL,
      "selected_draft_id" text,
      "drafts" jsonb DEFAULT '[]'::jsonb NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    )
  `);

  storySessionTableEnsured = true;
}
