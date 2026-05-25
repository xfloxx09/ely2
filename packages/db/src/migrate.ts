import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDb, closeDb } from "./index.js";

async function run() {
  console.log("Running migrations...");
  const db = getDb();
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");
  await closeDb();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
