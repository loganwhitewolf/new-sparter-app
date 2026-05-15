import 'server-only'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { getDatabasePoolConfig } from './config'
import * as schema from './schema'

const pool = new Pool(getDatabasePoolConfig())

export const db = drizzle(pool, { schema })

export type DbOrTx =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0]
