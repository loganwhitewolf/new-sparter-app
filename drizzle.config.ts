// DATABASE_URL is not available until Phase 2.
// Usage: npx drizzle-kit generate. Do not use push in production.
// ssl is passed explicitly (not via url) — drizzle-kit ignores ssl when using the url form.
import { defineConfig } from "drizzle-kit";

const u = new URL(process.env.DATABASE_URL!);

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "mysql",
  dbCredentials: {
    host: u.hostname,
    port: Number(u.port) || 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1),
    ssl: { rejectUnauthorized: true },
  },
});
