import type { PoolConfig } from 'pg'

export const DEFAULT_DATABASE_POOL_MAX = 2
export const MAX_DATABASE_POOL_MAX = 5

export type DatabasePoolEnv = {
  DATABASE_URL?: string
  DATABASE_SSL?: string
  DATABASE_POOL_MAX?: string
}

export type DatabasePoolConfig = Pick<PoolConfig, 'connectionString' | 'max' | 'ssl'>

/** Supabase pooler TLS uses a CA not in the Node trust store; use URL params instead of strict verify. */
export function enhanceDatabaseUrlForSsl(connectionString: string | undefined): string | undefined {
  if (!connectionString) {
    return connectionString
  }

  if (connectionString.includes('sslmode=') || connectionString.includes('ssl=')) {
    return connectionString
  }

  const separator = connectionString.includes('?') ? '&' : '?'
  return `${connectionString}${separator}uselibpqcompat=true&sslmode=require`
}

function parsePoolMax(value: string | undefined): number {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_DATABASE_POOL_MAX
  }

  if (!/^\d+$/.test(value.trim())) {
    return DEFAULT_DATABASE_POOL_MAX
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return DEFAULT_DATABASE_POOL_MAX
  }

  return Math.min(parsed, MAX_DATABASE_POOL_MAX)
}

export function getDatabasePoolConfig(env: DatabasePoolEnv = process.env as DatabasePoolEnv): DatabasePoolConfig {
  const sslEnabled = env.DATABASE_SSL === 'true'

  return {
    connectionString: sslEnabled ? enhanceDatabaseUrlForSsl(env.DATABASE_URL) : env.DATABASE_URL,
    max: parsePoolMax(env.DATABASE_POOL_MAX),
    ssl: undefined,
  }
}
