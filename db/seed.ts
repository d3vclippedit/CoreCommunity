/**
 * Dev seed — run with: pnpm db:seed
 * Populates local D1 with schema_version and a test user.
 */
import { drizzle } from "drizzle-orm/d1";
import { meta } from "./schema";

// For local dev seeding this script is run via wrangler with D1 bindings.
// Usage: wrangler d1 execute core-db --local --file=db/seed.sql
// Or via tsx + wrangler unstable_dev if you prefer programmatic access.

async function seed(db: ReturnType<typeof drizzle>) {
  console.log("Seeding meta table...");

  await db
    .insert(meta)
    .values({
      key: "schema_version",
      value: "1",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: meta.key,
      set: { value: "1", updatedAt: new Date() },
    });

  console.log("Done. schema_version = 1");
}

// When run directly, expect DB binding via wrangler
const db = drizzle((globalThis as unknown as { DB: D1Database }).DB);
seed(db).catch(console.error);
