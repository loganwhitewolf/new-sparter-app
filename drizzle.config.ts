// DATABASE_URL is not available until Phase 2.
// Usage: npx drizzle-kit generate. Do not use push in production.
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: true },
  },
})
