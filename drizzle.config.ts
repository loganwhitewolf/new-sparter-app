// Usage: npx drizzle-kit generate. Do not use push in production.
// For local dev: postgres://postgres:sparter@localhost:5432/sparter
// Operator commands: yarn db:migrate (local), db:migrate:staging, db:migrate:production — scripts/db-config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
