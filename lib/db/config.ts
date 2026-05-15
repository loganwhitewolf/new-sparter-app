import type { PoolConfig } from 'pg'

export const DEFAULT_DATABASE_POOL_MAX = 2
export const MAX_DATABASE_POOL_MAX = 5

export type DatabasePoolEnv = Pick<NodeJS.ProcessEnv, 'DATABASE_URL' | 'DATABASE_SSL' | 'DATABASE_POOL_MAX'>

export type DatabasePoolConfig = Pick<PoolConfig, 'connectionString' | 'max' | 'ssl'>

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

export function getDatabasePoolConfig(env: DatabasePoolEnv = process.env): DatabasePoolConfig {
  return {
    connectionString: env.DATABASE_URL,
    max: parsePoolMax(env.DATABASE_POOL_MAX),
    ssl: env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  }
}
