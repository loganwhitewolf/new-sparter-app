// Usage: npx drizzle-kit generate. Do not use push in production.
// For local dev: postgres://postgres:sparter@localhost:5432/sparter
// For production migrations: npm run db:migrate
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
