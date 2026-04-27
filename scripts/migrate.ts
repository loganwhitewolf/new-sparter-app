// Run with: npm run db:migrate
// Uses drizzle-orm's programmatic migrator — bypasses drizzle-kit's CLI
// which has a known SSL compatibility issue with TiDB Cloud serverless.
import { drizzle } from 'drizzle-orm/mysql2'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import mysql from 'mysql2/promise'

// Load .env before anything else (no server-only guard in scripts)
process.loadEnvFile?.('.env')

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL non trovato. Controlla .env')
  process.exit(1)
}

const pool = mysql.createPool({
  uri: DATABASE_URL,
  ssl: { rejectUnauthorized: true },
})

const db = drizzle(pool)

async function main() {
  console.log('Applicando migrations...')
  await migrate(db, { migrationsFolder: './drizzle/migrations' })
  console.log('Migration completata.')
  await pool.end()
}

main().catch((err) => {
  console.error('Migration fallita:', err)
  process.exit(1)
})
