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
  resolveOperatorDatabaseTarget,
  sanitizeMigrationError,
  type OperatorDatabaseConfigResult,
  type OperatorDatabaseEnv,
  type OperatorDatabaseTarget,
} from '@/scripts/db-config'

function operatorConfigFor(
  env: OperatorDatabaseEnv = {},
  target: OperatorDatabaseTarget = 'production',
) {
  return getOperatorDatabaseConfig({ env, target })
}

function expectSuccess(result: OperatorDatabaseConfigResult): Extract<OperatorDatabaseConfigResult, { ok: true }> {
  expect(result).toMatchObject({ ok: true })
  if (!result.ok) {
    throw new Error(`Expected successful operator database config, received ${result.error.code}`)
  }

  return result
}

function confirmedProductionEnv(env: OperatorDatabaseEnv = {}): OperatorDatabaseEnv {
  return {
    PRODUCTION_DATABASE_URL: 'postgres://production-user:production-password@production.example.com:5432/app',
    PRODUCTION_MIGRATION_CONFIRM: PRODUCTION_MIGRATION_CONFIRM_VALUE,
    ...env,
  }
}

function localEnv(env: OperatorDatabaseEnv = {}): OperatorDatabaseEnv {
  return {
    DATABASE_URL: 'postgres://postgres:sparter@localhost:5432/sparter',
    ...env,
  }
}

function stagingEnv(env: OperatorDatabaseEnv = {}): OperatorDatabaseEnv {
  return {
    STAGING_DATABASE_URL: 'postgres://staging-user:staging-password@staging.example.com:5432/app',
    ...env,
  }
}

describe('resolveOperatorDatabaseTarget', () => {
  it('maps CLI flags to targets', () => {
    expect(resolveOperatorDatabaseTarget(['--production'])).toBe('production')
    expect(resolveOperatorDatabaseTarget(['--staging'])).toBe('staging')
    expect(resolveOperatorDatabaseTarget([])).toBe('local')
  })
})

describe('getOperatorDatabaseConfig — local', () => {
  it('rejects missing or blank DATABASE_URL', () => {
    expect(operatorConfigFor({}, 'local')).toEqual({
      ok: false,
      error: {
        code: 'missing_database_url',
        message: 'DATABASE_URL is required in .env for yarn db:migrate and matching db:seed commands.',
      },
    })

    expect(operatorConfigFor({ DATABASE_URL: '   ' }, 'local')).toEqual({
      ok: false,
      error: {
        code: 'missing_database_url',
        message: 'DATABASE_URL is required in .env for yarn db:migrate and matching db:seed commands.',
      },
    })
  })

  it('does not require production confirmation', () => {
    const result = expectSuccess(operatorConfigFor(localEnv(), 'local'))
    expect(result.config.target).toBe('local')
    expect(result.config.connectionString).toContain('localhost')
  })

  it('uses DATABASE_SSL and DATABASE_POOL_MAX when set', () => {
    const result = expectSuccess(
      operatorConfigFor(
        localEnv({
          DATABASE_SSL: 'true',
          DATABASE_POOL_MAX: String(MAX_OPERATOR_POOL_MAX),
        }),
        'local',
      ),
    )

    expect(result.config.ssl).toEqual({ rejectUnauthorized: true })
    expect(result.config.max).toBe(MAX_OPERATOR_POOL_MAX)
  })
})

describe('getOperatorDatabaseConfig — staging', () => {
  it('rejects missing STAGING_DATABASE_URL', () => {
    expect(operatorConfigFor({}, 'staging')).toEqual({
      ok: false,
      error: {
        code: 'missing_staging_database_url',
        message:
          'STAGING_DATABASE_URL is required in .env for yarn db:migrate:staging and matching db:seed commands.',
      },
    })
  })

  it('accepts staging URL without production confirmation', () => {
    const result = expectSuccess(operatorConfigFor(stagingEnv(), 'staging'))
    expect(result.config.target).toBe('staging')
    expect(result.diagnostics.host).toBe('staging.example.com')
  })
})

describe('getOperatorDatabaseConfig — production', () => {
  it('rejects missing or blank PRODUCTION_DATABASE_URL before returning config', () => {
    expect(operatorConfigFor({ PRODUCTION_MIGRATION_CONFIRM: PRODUCTION_MIGRATION_CONFIRM_VALUE }, 'production')).toEqual({
      ok: false,
      error: {
        code: 'missing_production_database_url',
        message:
          'PRODUCTION_DATABASE_URL is required in .env for yarn db:migrate:production and matching db:seed commands.',
      },
    })

    expect(
      operatorConfigFor(
        {
          PRODUCTION_DATABASE_URL: '   ',
          PRODUCTION_MIGRATION_CONFIRM: PRODUCTION_MIGRATION_CONFIRM_VALUE,
        },
        'production',
      ),
    ).toEqual({
      ok: false,
      error: {
        code: 'missing_production_database_url',
        message:
          'PRODUCTION_DATABASE_URL is required in .env for yarn db:migrate:production and matching db:seed commands.',
      },
    })
  })

  it('rejects missing or wrong production confirmation values', () => {
    expect(
      operatorConfigFor({ PRODUCTION_DATABASE_URL: 'postgres://production.example.com/app' }, 'production'),
    ).toEqual({
      ok: false,
      error: {
        code: 'missing_production_migration_confirm',
        message: `Set PRODUCTION_MIGRATION_CONFIRM=${PRODUCTION_MIGRATION_CONFIRM_VALUE} in .env to run production operator database commands.`,
      },
    })

    expect(
      operatorConfigFor(
        {
          PRODUCTION_DATABASE_URL: 'postgres://production.example.com/app',
          PRODUCTION_MIGRATION_CONFIRM: 'yes',
        },
        'production',
      ),
    ).toEqual({
      ok: false,
      error: {
        code: 'invalid_production_migration_confirm',
        message: `Set PRODUCTION_MIGRATION_CONFIRM=${PRODUCTION_MIGRATION_CONFIRM_VALUE} in .env to run production operator database commands.`,
      },
    })
  })

  it('defaults, falls back, and caps PRODUCTION_DATABASE_POOL_MAX', () => {
    expect(expectSuccess(operatorConfigFor(confirmedProductionEnv(), 'production')).config.max).toBe(
      DEFAULT_OPERATOR_POOL_MAX,
    )

    for (const malformedValue of ['', '   ', 'abc', '0', '-1']) {
      const result = expectSuccess(
        operatorConfigFor(confirmedProductionEnv({ PRODUCTION_DATABASE_POOL_MAX: malformedValue }), 'production'),
      )

      expect(result.config.max).toBe(DEFAULT_OPERATOR_POOL_MAX)
    }

    expect(
      expectSuccess(
        operatorConfigFor(
          confirmedProductionEnv({ PRODUCTION_DATABASE_POOL_MAX: String(MAX_OPERATOR_POOL_MAX) }),
          'production',
        ),
      ).config.max,
    ).toBe(MAX_OPERATOR_POOL_MAX)
    expect(
      expectSuccess(
        operatorConfigFor(confirmedProductionEnv({ PRODUCTION_DATABASE_POOL_MAX: '999' }), 'production'),
      ).config.max,
    ).toBe(MAX_OPERATOR_POOL_MAX)
  })

  it('enables strict TLS only when PRODUCTION_DATABASE_SSL is exactly true', () => {
    expect(
      expectSuccess(operatorConfigFor(confirmedProductionEnv({ PRODUCTION_DATABASE_SSL: 'true' }), 'production'))
        .config.ssl,
    ).toEqual({
      rejectUnauthorized: true,
    })
    expect(
      expectSuccess(operatorConfigFor(confirmedProductionEnv({ PRODUCTION_DATABASE_SSL: 'false' }), 'production'))
        .config.ssl,
    ).toBeUndefined()
    expect(expectSuccess(operatorConfigFor(confirmedProductionEnv(), 'production')).config.ssl).toBeUndefined()
  })

  it('returns diagnostics with host for CLI status output', () => {
    const result = expectSuccess(
      operatorConfigFor(
        confirmedProductionEnv({
          PRODUCTION_DATABASE_SSL: 'true',
          PRODUCTION_DATABASE_URL: 'postgres://user:pass@aws-1-eu-central-1.pooler.supabase.com:6543/postgres',
        }),
        'production',
      ),
    )

    expect(result.diagnostics).toEqual({
      target: 'production',
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
        confirmedProductionEnv({
          PRODUCTION_DATABASE_SSL: 'true',
          PRODUCTION_DATABASE_URL: 'postgres://user:pass@aws-1-eu-central-1.pooler.supabase.com:6543/postgres',
        }),
        'production',
      ),
    )

    expect(pgPoolConfigFromOperatorConfig(config).connectionString).toContain('sslmode=require')
    expect(connectionStringWithSsl(config)).toContain('sslmode=require')
  })
})

describe('operatorConnectionFailureHint', () => {
  it('warns for direct Supabase hosts with the matching env var name', () => {
    expect(operatorConnectionFailureHint('db.rceujonrgergjljpegly.supabase.co', 'production')).toContain(
      'PRODUCTION_DATABASE_URL',
    )
    expect(operatorConnectionFailureHint('db.rceujonrgergjljpegly.supabase.co', 'staging')).toContain(
      'STAGING_DATABASE_URL',
    )
    expect(operatorConnectionFailureHint('aws-1-eu-central-1.pooler.supabase.com', 'production')).toBeUndefined()
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
