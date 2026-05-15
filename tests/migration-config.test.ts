import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRODUCTION_MIGRATION_POOL_MAX,
  MAX_PRODUCTION_MIGRATION_POOL_MAX,
  PRODUCTION_MIGRATION_CONFIRM_VALUE,
  getMigrationConfig,
  sanitizeMigrationError,
  type MigrationConfigEnv,
  type MigrationConfigResult,
} from '@/scripts/migration-config'

function productionConfigFor(env: MigrationConfigEnv = {}) {
  return getMigrationConfig({ mode: 'production', env })
}

function expectSuccess(result: MigrationConfigResult): Extract<MigrationConfigResult, { ok: true }> {
  expect(result).toMatchObject({ ok: true })
  if (!result.ok) {
    throw new Error(`Expected successful migration config, received ${result.error.code}`)
  }

  return result
}

function confirmedProductionEnv(env: MigrationConfigEnv = {}): MigrationConfigEnv {
  return {
    PRODUCTION_DATABASE_URL: 'postgres://production-user:production-password@production.example.com:5432/app',
    PRODUCTION_MIGRATION_CONFIRM: PRODUCTION_MIGRATION_CONFIRM_VALUE,
    ...env,
  }
}

describe('getMigrationConfig production guardrails', () => {
  it('rejects missing or blank PRODUCTION_DATABASE_URL before returning production config', () => {
    expect(productionConfigFor({ PRODUCTION_MIGRATION_CONFIRM: PRODUCTION_MIGRATION_CONFIRM_VALUE })).toEqual({
      ok: false,
      error: {
        code: 'missing_production_database_url',
        message: 'PRODUCTION_DATABASE_URL is required for production migrations.',
      },
    })

    expect(
      productionConfigFor({
        PRODUCTION_DATABASE_URL: '   ',
        PRODUCTION_MIGRATION_CONFIRM: PRODUCTION_MIGRATION_CONFIRM_VALUE,
      }),
    ).toEqual({
      ok: false,
      error: {
        code: 'missing_production_database_url',
        message: 'PRODUCTION_DATABASE_URL is required for production migrations.',
      },
    })
  })

  it('rejects missing or wrong production confirmation values', () => {
    expect(productionConfigFor({ PRODUCTION_DATABASE_URL: 'postgres://production.example.com/app' })).toEqual({
      ok: false,
      error: {
        code: 'missing_production_migration_confirm',
        message: `Set PRODUCTION_MIGRATION_CONFIRM=${PRODUCTION_MIGRATION_CONFIRM_VALUE} to run production migrations.`,
      },
    })

    expect(
      productionConfigFor({
        PRODUCTION_DATABASE_URL: 'postgres://production.example.com/app',
        PRODUCTION_MIGRATION_CONFIRM: 'yes',
      }),
    ).toEqual({
      ok: false,
      error: {
        code: 'invalid_production_migration_confirm',
        message: `Set PRODUCTION_MIGRATION_CONFIRM=${PRODUCTION_MIGRATION_CONFIRM_VALUE} to run production migrations.`,
      },
    })
  })

  it('uses only PRODUCTION_DATABASE_URL for production and ignores DATABASE_URL', () => {
    const result = expectSuccess(
      productionConfigFor(
        confirmedProductionEnv({
          DATABASE_URL: 'postgres://local-user:local-password@localhost:5432/local-db',
          PRODUCTION_DATABASE_URL: 'production-url-sentinel',
        }),
      ),
    )

    expect(result.config.connectionString).toBe('production-url-sentinel')
  })

  it('defaults, falls back, and caps PRODUCTION_DATABASE_POOL_MAX for production', () => {
    expect(expectSuccess(productionConfigFor(confirmedProductionEnv())).config.max).toBe(
      DEFAULT_PRODUCTION_MIGRATION_POOL_MAX,
    )

    for (const malformedValue of ['', '   ', 'abc', '0', '-1']) {
      const result = expectSuccess(
        productionConfigFor(confirmedProductionEnv({ PRODUCTION_DATABASE_POOL_MAX: malformedValue })),
      )

      expect(result.config.max).toBe(DEFAULT_PRODUCTION_MIGRATION_POOL_MAX)
    }

    expect(
      expectSuccess(
        productionConfigFor(
          confirmedProductionEnv({ PRODUCTION_DATABASE_POOL_MAX: String(MAX_PRODUCTION_MIGRATION_POOL_MAX) }),
        ),
      ).config.max,
    ).toBe(MAX_PRODUCTION_MIGRATION_POOL_MAX)
    expect(expectSuccess(productionConfigFor(confirmedProductionEnv({ PRODUCTION_DATABASE_POOL_MAX: '999' }))).config.max).toBe(
      MAX_PRODUCTION_MIGRATION_POOL_MAX,
    )
  })

  it('enables strict TLS only when PRODUCTION_DATABASE_SSL is exactly true', () => {
    expect(expectSuccess(productionConfigFor(confirmedProductionEnv({ PRODUCTION_DATABASE_SSL: 'true' }))).config.ssl).toEqual({
      rejectUnauthorized: true,
    })
    expect(expectSuccess(productionConfigFor(confirmedProductionEnv({ PRODUCTION_DATABASE_SSL: 'false' }))).config.ssl).toBeUndefined()
    expect(expectSuccess(productionConfigFor(confirmedProductionEnv({ PRODUCTION_DATABASE_SSL: 'TRUE' }))).config.ssl).toBeUndefined()
    expect(expectSuccess(productionConfigFor(confirmedProductionEnv())).config.ssl).toBeUndefined()
  })

  it('returns production diagnostics that are safe for CLI status output', () => {
    const result = expectSuccess(productionConfigFor(confirmedProductionEnv({ PRODUCTION_DATABASE_SSL: 'true' })))

    expect(result).toMatchObject({
      config: {
        targetClass: 'production',
        migrationsFolder: './drizzle/migrations',
        max: DEFAULT_PRODUCTION_MIGRATION_POOL_MAX,
        ssl: { rejectUnauthorized: true },
      },
      diagnostics: {
        targetClass: 'production',
        migrationsFolder: './drizzle/migrations',
        poolMax: DEFAULT_PRODUCTION_MIGRATION_POOL_MAX,
        sslEnabled: true,
      },
    })
  })
})

describe('getMigrationConfig local mode', () => {
  it('models the default local migration target without production confirmation', () => {
    const result = getMigrationConfig({
      mode: 'local',
      env: {
        DATABASE_URL: 'local-url-sentinel',
        DATABASE_SSL: 'true',
      },
    })

    expect(result).toEqual({
      ok: true,
      config: {
        targetClass: 'local',
        connectionString: 'local-url-sentinel',
        migrationsFolder: './drizzle/migrations',
        max: 1,
        ssl: { rejectUnauthorized: true },
      },
      diagnostics: {
        targetClass: 'local',
        migrationsFolder: './drizzle/migrations',
        poolMax: 1,
        sslEnabled: true,
      },
    })
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
    expect(JSON.stringify(result)).not.toContain('postgres://')
    expect(JSON.stringify(result)).not.toContain('raw stack frame')
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
    expect(JSON.stringify(result)).not.toContain('db.example.com')
    expect(Object.keys(result).sort()).toEqual(['className', 'code', 'message'])
  })
})
