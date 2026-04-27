// DATABASE_URL is not available until Phase 2.
// Usage: npx drizzle-kit generate. Do not use push in production.
// For local dev: mysql://root:sparter@localhost:3306/sparter (Docker)
// For production migrations: npm run db:migrate (scripts/migrate.ts — handles TiDB Cloud SSL)
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
