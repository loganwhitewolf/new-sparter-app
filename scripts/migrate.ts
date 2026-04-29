// Run with: npm run db:migrate
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { existsSync } from 'node:fs'
import { Pool } from 'pg'

// Load local env before anything else (no server-only guard in scripts)
for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile)) {
    process.loadEnvFile?.(envFile)
  }
}

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL non trovato. Controlla .env.local o .env')
  process.exit(1)
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  ssl:
    process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: true }
      : undefined,
})

const db = drizzle(pool)

async function main() {
  console.log('Applicando migrations...')
  await migrate(db, { migrationsFolder: './drizzle/migrations' })
  console.log('Migration completata.')
}

main().catch((err) => {
  console.error('Migration fallita:', err)
  process.exitCode = 1
}).finally(async () => {
  await pool.end()
})
