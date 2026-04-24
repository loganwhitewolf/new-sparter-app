import 'server-only'

export const db =
  null as unknown as import('drizzle-orm/mysql2').MySql2Database

export type DbOrTx = typeof db
