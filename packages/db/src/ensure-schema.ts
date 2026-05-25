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
