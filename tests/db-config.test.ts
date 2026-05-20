import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OPERATOR_POOL_MAX,
  MAX_OPERATOR_POOL_MAX,
  PRODUCTION_MIGRATION_CONFIRM_VALUE,
  connectionStringWithSsl,
  getOperatorDatabaseConfig,
  isDirectSupabaseHost,
  operatorConnectionFailureHint,
  pgPoolConfigFromOperatorConfig,
  sanitizeMigrationError,
  type OperatorDatabaseConfigResult,
  type OperatorDatabaseEnv,
} from '@/scripts/db-config'

function operatorConfigFor(env: OperatorDatabaseEnv = {}) {
  return getOperatorDatabaseConfig({ env })
}

function expectSuccess(result: OperatorDatabaseConfigResult): Extract<OperatorDatabaseConfigResult, { ok: true }> {
  expect(result).toMatchObject({ ok: true })
  if (!result.ok) {
    throw new Error(`Expected successful operator database config, received ${result.error.code}`)
  }

  return result
}

function confirmedOperatorEnv(env: OperatorDatabaseEnv = {}): OperatorDatabaseEnv {
  return {
    PRODUCTION_DATABASE_URL: 'postgres://production-user:production-password@production.example.com:5432/app',
    PRODUCTION_MIGRATION_CONFIRM: PRODUCTION_MIGRATION_CONFIRM_VALUE,
    ...env,
  }
}

describe('getOperatorDatabaseConfig guardrails', () => {
  it('rejects missing or blank PRODUCTION_DATABASE_URL before returning config', () => {
    expect(operatorConfigFor({ PRODUCTION_MIGRATION_CONFIRM: PRODUCTION_MIGRATION_CONFIRM_VALUE })).toEqual({
      ok: false,
      error: {
        code: 'missing_production_database_url',
        message: 'PRODUCTION_DATABASE_URL is required in .env for operator database commands.',
      },
    })

    expect(
      operatorConfigFor({
        PRODUCTION_DATABASE_URL: '   ',
        PRODUCTION_MIGRATION_CONFIRM: PRODUCTION_MIGRATION_CONFIRM_VALUE,
      }),
    ).toEqual({
      ok: false,
      error: {
        code: 'missing_production_database_url',
        message: 'PRODUCTION_DATABASE_URL is required in .env for operator database commands.',
      },
    })
  })

  it('rejects missing or wrong production confirmation values', () => {
    expect(operatorConfigFor({ PRODUCTION_DATABASE_URL: 'postgres://production.example.com/app' })).toEqual({
      ok: false,
      error: {
        code: 'missing_production_migration_confirm',
        message: `Set PRODUCTION_MIGRATION_CONFIRM=${PRODUCTION_MIGRATION_CONFIRM_VALUE} in .env to run operator database commands.`,
      },
    })

    expect(
      operatorConfigFor({
        PRODUCTION_DATABASE_URL: 'postgres://production.example.com/app',
        PRODUCTION_MIGRATION_CONFIRM: 'yes',
      }),
    ).toEqual({
      ok: false,
      error: {
        code: 'invalid_production_migration_confirm',
        message: `Set PRODUCTION_MIGRATION_CONFIRM=${PRODUCTION_MIGRATION_CONFIRM_VALUE} in .env to run operator database commands.`,
      },
    })
  })

  it('defaults, falls back, and caps PRODUCTION_DATABASE_POOL_MAX', () => {
    expect(expectSuccess(operatorConfigFor(confirmedOperatorEnv())).config.max).toBe(DEFAULT_OPERATOR_POOL_MAX)

    for (const malformedValue of ['', '   ', 'abc', '0', '-1']) {
      const result = expectSuccess(
        operatorConfigFor(confirmedOperatorEnv({ PRODUCTION_DATABASE_POOL_MAX: malformedValue })),
      )

      expect(result.config.max).toBe(DEFAULT_OPERATOR_POOL_MAX)
    }

    expect(
      expectSuccess(
        operatorConfigFor(confirmedOperatorEnv({ PRODUCTION_DATABASE_POOL_MAX: String(MAX_OPERATOR_POOL_MAX) })),
      ).config.max,
    ).toBe(MAX_OPERATOR_POOL_MAX)
    expect(
      expectSuccess(operatorConfigFor(confirmedOperatorEnv({ PRODUCTION_DATABASE_POOL_MAX: '999' }))).config.max,
    ).toBe(MAX_OPERATOR_POOL_MAX)
  })

  it('enables strict TLS only when PRODUCTION_DATABASE_SSL is exactly true', () => {
    expect(expectSuccess(operatorConfigFor(confirmedOperatorEnv({ PRODUCTION_DATABASE_SSL: 'true' }))).config.ssl).toEqual({
      rejectUnauthorized: true,
    })
    expect(expectSuccess(operatorConfigFor(confirmedOperatorEnv({ PRODUCTION_DATABASE_SSL: 'false' }))).config.ssl).toBeUndefined()
    expect(expectSuccess(operatorConfigFor(confirmedOperatorEnv())).config.ssl).toBeUndefined()
  })

  it('returns diagnostics with host for CLI status output', () => {
    const result = expectSuccess(
      operatorConfigFor(
        confirmedOperatorEnv({
          PRODUCTION_DATABASE_SSL: 'true',
          PRODUCTION_DATABASE_URL: 'postgres://user:pass@aws-1-eu-central-1.pooler.supabase.com:6543/postgres',
        }),
      ),
    )

    expect(result.diagnostics).toEqual({
      targetClass: 'production',
      migrationsFolder: './drizzle/migrations',
      poolMax: DEFAULT_OPERATOR_POOL_MAX,
      sslEnabled: true,
      host: 'aws-1-eu-central-1.pooler.supabase.com',
    })
  })
})

describe('pgPoolConfigFromOperatorConfig', () => {
  it('appends ssl query params when production ssl is enabled', () => {
    const { config } = expectSuccess(
      operatorConfigFor(
        confirmedOperatorEnv({
          PRODUCTION_DATABASE_SSL: 'true',
          PRODUCTION_DATABASE_URL: 'postgres://user:pass@aws-1-eu-central-1.pooler.supabase.com:6543/postgres',
        }),
      ),
    )

    expect(pgPoolConfigFromOperatorConfig(config).connectionString).toContain('sslmode=require')
    expect(connectionStringWithSsl(config)).toContain('sslmode=require')
  })
})

describe('operatorConnectionFailureHint', () => {
  it('warns for direct Supabase hosts', () => {
    expect(operatorConnectionFailureHint('db.rceujonrgergjljpegly.supabase.co')).toContain('PRODUCTION_DATABASE_URL')
    expect(operatorConnectionFailureHint('aws-1-eu-central-1.pooler.supabase.com')).toBeUndefined()
    expect(isDirectSupabaseHost('db.rceujonrgergjljpegly.supabase.co')).toBe(true)
  })
})

describe('sanitizeMigrationError', () => {
  it('redacts secret-bearing unknown error strings and exposes only safe classes and codes', () => {
    const result = sanitizeMigrationError(
      new Error(
        'password=super-secret postgres://user:secret@db.example.com:5432/app failed at /private/path\n    at raw stack frame',
      ),
    )

    expect(result).toEqual({
      code: 'migration_unknown_error',
      className: 'Error',
      message: 'Migration failed. See sanitized diagnostics for the stable failure code.',
    })
    expect(JSON.stringify(result)).not.toContain('super-secret')
    expect(JSON.stringify(result)).not.toContain('secret@db.example.com')
  })

  it('keeps safe driver-style error codes while omitting raw error objects', () => {
    const result = sanitizeMigrationError({
      code: '28P01',
      message: 'password authentication failed for user app with password hunter2',
      stack: 'raw stack',
      connectionString: 'postgres://user:hunter2@db.example.com/app',
    })

    expect(result).toEqual({
      code: '28P01',
      className: 'Object',
      message: 'Migration failed. See sanitized diagnostics for the stable failure code.',
    })
    expect(JSON.stringify(result)).not.toContain('hunter2')
  })
})
