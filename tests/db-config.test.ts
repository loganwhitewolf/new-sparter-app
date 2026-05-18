import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DATABASE_POOL_MAX,
  MAX_DATABASE_POOL_MAX,
  getDatabasePoolConfig,
  type DatabasePoolEnv,
} from '@/lib/db/config'

function configFor(env: DatabasePoolEnv = {}) {
  return getDatabasePoolConfig(env)
}

describe('getDatabasePoolConfig', () => {
  it('uses a low serverless-safe default pool max when DATABASE_POOL_MAX is unset', () => {
    expect(configFor().max).toBe(DEFAULT_DATABASE_POOL_MAX)
  })

  it('uses a valid integer DATABASE_POOL_MAX value', () => {
    expect(configFor({ DATABASE_POOL_MAX: '3' }).max).toBe(3)
  })

  it('falls back to the default for malformed DATABASE_POOL_MAX values', () => {
    expect(configFor({ DATABASE_POOL_MAX: 'abc' }).max).toBe(DEFAULT_DATABASE_POOL_MAX)
    expect(configFor({ DATABASE_POOL_MAX: '1.5' }).max).toBe(DEFAULT_DATABASE_POOL_MAX)
    expect(configFor({ DATABASE_POOL_MAX: '' }).max).toBe(DEFAULT_DATABASE_POOL_MAX)
    expect(configFor({ DATABASE_POOL_MAX: '   ' }).max).toBe(DEFAULT_DATABASE_POOL_MAX)
  })

  it('falls back to the default for zero or negative DATABASE_POOL_MAX values', () => {
    expect(configFor({ DATABASE_POOL_MAX: '0' }).max).toBe(DEFAULT_DATABASE_POOL_MAX)
    expect(configFor({ DATABASE_POOL_MAX: '-1' }).max).toBe(DEFAULT_DATABASE_POOL_MAX)
  })

  it('clamps too-large DATABASE_POOL_MAX values to the conservative upper bound', () => {
    expect(configFor({ DATABASE_POOL_MAX: String(MAX_DATABASE_POOL_MAX) }).max).toBe(MAX_DATABASE_POOL_MAX)
    expect(configFor({ DATABASE_POOL_MAX: String(MAX_DATABASE_POOL_MAX + 1) }).max).toBe(MAX_DATABASE_POOL_MAX)
    expect(configFor({ DATABASE_POOL_MAX: '999' }).max).toBe(MAX_DATABASE_POOL_MAX)
  })

  it('enables Supabase-compatible TLS via connection-string params when DATABASE_SSL=true', () => {
    const config = configFor({
      DATABASE_URL: 'postgresql://user:pass@pooler.example.com:6543/postgres',
      DATABASE_SSL: 'true',
    })

    expect(config.ssl).toBeUndefined()
    expect(config.connectionString).toBe(
      'postgresql://user:pass@pooler.example.com:6543/postgres?uselibpqcompat=true&sslmode=require',
    )
    expect(configFor({ DATABASE_SSL: 'false' }).connectionString).toBeUndefined()
    expect(configFor({ DATABASE_SSL: 'TRUE' }).connectionString).toBeUndefined()
    expect(
      configFor({
        DATABASE_URL: 'postgresql://user:pass@pooler.example.com:6543/postgres?sslmode=require',
        DATABASE_SSL: 'true',
      }).connectionString,
    ).toBe('postgresql://user:pass@pooler.example.com:6543/postgres?sslmode=require')
  })

  it('passes DATABASE_URL through only to the Pool config without deriving secret-bearing fields', () => {
    const config = configFor({ DATABASE_URL: 'database-url-sentinel' })

    expect(config.connectionString).toBe('database-url-sentinel')
    expect(Object.keys(config).sort()).toEqual(['connectionString', 'max', 'ssl'])
  })
})
