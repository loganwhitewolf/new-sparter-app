import 'server-only'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 10,
  ssl:
    process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: true }
      : undefined,
})

export const db = drizzle(pool, { schema })

export type DbOrTx =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0]
