/** Shared operator DB config for yarn db:migrate* and yarn db:seed* (target-specific env in .env). */
import { existsSync } from 'node:fs'
import type { PoolConfig } from 'pg'
import { enhanceDatabaseUrlForSsl } from '../lib/db/config'

export const OPERATOR_ENV_FILE = '.env'
export const DEFAULT_MIGRATIONS_FOLDER = './drizzle/migrations'
export const DEFAULT_OPERATOR_POOL_MAX = 1
export const MAX_OPERATOR_POOL_MAX = 2
export const PRODUCTION_MIGRATION_CONFIRM_VALUE = 'apply-to-production'

export type OperatorDatabaseTarget = 'local' | 'staging' | 'production'

export type OperatorDatabaseEnv = {
  DATABASE_URL?: string
  DATABASE_SSL?: string
  DATABASE_POOL_MAX?: string
  STAGING_DATABASE_URL?: string
  STAGING_DATABASE_SSL?: string
  STAGING_DATABASE_POOL_MAX?: string
  PRODUCTION_DATABASE_URL?: string
  PRODUCTION_DATABASE_SSL?: string
  PRODUCTION_DATABASE_POOL_MAX?: string
  PRODUCTION_MIGRATION_CONFIRM?: string
}

export type OperatorSslConfig = {
  rejectUnauthorized: true
}

export type OperatorDatabaseConfig = {
  target: OperatorDatabaseTarget
  connectionString: string
  migrationsFolder: string
  max: number
  ssl?: OperatorSslConfig
}

export type OperatorDatabaseDiagnostics = {
  target: OperatorDatabaseTarget
  migrationsFolder: string
  poolMax: number
  sslEnabled: boolean
  host: string | undefined
}

export type OperatorValidationErrorCode =
  | 'missing_database_url'
  | 'missing_staging_database_url'
  | 'missing_production_database_url'
  | 'missing_production_migration_confirm'
  | 'invalid_production_migration_confirm'

export type SafeMigrationErrorCode = OperatorValidationErrorCode | 'migration_unknown_error' | string

export type SafeMigrationError = {
  code: SafeMigrationErrorCode
  message: string
  className?: string
}

export type OperatorDatabaseConfigResult =
  | {
      ok: true
      config: OperatorDatabaseConfig
      diagnostics: OperatorDatabaseDiagnostics
    }
  | {
      ok: false
      error: SafeMigrationError
    }

export type GetOperatorDatabaseConfigOptions = {
  target?: OperatorDatabaseTarget
  env?: OperatorDatabaseEnv
  migrationsFolder?: string
}

type TargetSpec = {
  target: OperatorDatabaseTarget
  urlKey: keyof OperatorDatabaseEnv
  sslKey: keyof OperatorDatabaseEnv
  poolMaxKey: keyof OperatorDatabaseEnv
  missingCode: OperatorValidationErrorCode
  requiresProductionConfirm: boolean
}

const TARGET_SPECS: Record<OperatorDatabaseTarget, TargetSpec> = {
  local: {
    target: 'local',
    urlKey: 'DATABASE_URL',
    sslKey: 'DATABASE_SSL',
    poolMaxKey: 'DATABASE_POOL_MAX',
    missingCode: 'missing_database_url',
    requiresProductionConfirm: false,
  },
  staging: {
    target: 'staging',
    urlKey: 'STAGING_DATABASE_URL',
    sslKey: 'STAGING_DATABASE_SSL',
    poolMaxKey: 'STAGING_DATABASE_POOL_MAX',
    missingCode: 'missing_staging_database_url',
    requiresProductionConfirm: false,
  },
  production: {
    target: 'production',
    urlKey: 'PRODUCTION_DATABASE_URL',
    sslKey: 'PRODUCTION_DATABASE_SSL',
    poolMaxKey: 'PRODUCTION_DATABASE_POOL_MAX',
    missingCode: 'missing_production_database_url',
    requiresProductionConfirm: true,
  },
}

/** Operator migrate/seed scripts read secrets from .env only (not .env.local). */
export function loadOperatorEnv(): void {
  if (existsSync(OPERATOR_ENV_FILE)) {
    process.loadEnvFile?.(OPERATOR_ENV_FILE)
  }
}

export function resolveOperatorDatabaseTarget(argv: string[] = process.argv.slice(2)): OperatorDatabaseTarget {
  if (argv.includes('--production')) {
    return 'production'
  }

  if (argv.includes('--staging')) {
    return 'staging'
  }

  if (argv.includes('--local')) {
    return 'local'
  }

  const fromEnv = process.env.OPERATOR_DATABASE_TARGET ?? process.env.MIGRATION_TARGET
  if (fromEnv === 'production' || fromEnv === 'staging' || fromEnv === 'local') {
    return fromEnv
  }

  return 'local'
}

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === ''
}

function parseOperatorPoolMax(value: string | undefined): number {
  if (isBlank(value)) {
    return DEFAULT_OPERATOR_POOL_MAX
  }

  const trimmed = value?.trim() ?? ''
  if (!/^\d+$/.test(trimmed)) {
    return DEFAULT_OPERATOR_POOL_MAX
  }

  const parsed = Number(trimmed)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return DEFAULT_OPERATOR_POOL_MAX
  }

  return Math.min(parsed, MAX_OPERATOR_POOL_MAX)
}

function strictSsl(enabled: string | undefined): OperatorSslConfig | undefined {
  return enabled === 'true' ? { rejectUnauthorized: true } : undefined
}

export function connectionHost(connectionString: string | undefined): string | undefined {
  if (!connectionString) {
    return undefined
  }

  try {
    return new URL(connectionString.replace(/^postgres:/, 'http:')).hostname
  } catch {
    return undefined
  }
}

function diagnosticsFor(config: OperatorDatabaseConfig): OperatorDatabaseDiagnostics {
  return {
    target: config.target,
    migrationsFolder: config.migrationsFolder,
    poolMax: config.max,
    sslEnabled: config.ssl?.rejectUnauthorized === true,
    host: connectionHost(config.connectionString),
  }
}

function productionConfirmationError(value: string | undefined): SafeMigrationError | undefined {
  if (value === undefined || value.trim() === '') {
    return {
      code: 'missing_production_migration_confirm',
      message: `Set PRODUCTION_MIGRATION_CONFIRM=${PRODUCTION_MIGRATION_CONFIRM_VALUE} in ${OPERATOR_ENV_FILE} to run production operator database commands.`,
    }
  }

  if (value !== PRODUCTION_MIGRATION_CONFIRM_VALUE) {
    return {
      code: 'invalid_production_migration_confirm',
      message: `Set PRODUCTION_MIGRATION_CONFIRM=${PRODUCTION_MIGRATION_CONFIRM_VALUE} in ${OPERATOR_ENV_FILE} to run production operator database commands.`,
    }
  }

  return undefined
}

function envValue(env: OperatorDatabaseEnv, key: keyof OperatorDatabaseEnv): string | undefined {
  return env[key]
}

function missingUrlMessage(spec: TargetSpec): string {
  return `${spec.urlKey} is required in ${OPERATOR_ENV_FILE} for yarn db:migrate${spec.target === 'local' ? '' : `:${spec.target}`} and matching db:seed commands.`
}

export function getOperatorDatabaseConfig(
  options: GetOperatorDatabaseConfigOptions = {},
): OperatorDatabaseConfigResult {
  const target = options.target ?? resolveOperatorDatabaseTarget()
  const spec = TARGET_SPECS[target]
  const env = options.env ?? (process.env as OperatorDatabaseEnv)
  const migrationsFolder = options.migrationsFolder ?? DEFAULT_MIGRATIONS_FOLDER

  const databaseUrl = envValue(env, spec.urlKey)
  if (isBlank(databaseUrl)) {
    return {
      ok: false,
      error: {
        code: spec.missingCode,
        message: missingUrlMessage(spec),
      },
    }
  }

  if (spec.requiresProductionConfirm) {
    const confirmationError = productionConfirmationError(env.PRODUCTION_MIGRATION_CONFIRM)
    if (confirmationError) {
      return { ok: false, error: confirmationError }
    }
  }

  const connectionString = databaseUrl!.trim()

  const config: OperatorDatabaseConfig = {
    target: spec.target,
    connectionString,
    migrationsFolder,
    max: parseOperatorPoolMax(envValue(env, spec.poolMaxKey)),
    ssl: strictSsl(envValue(env, spec.sslKey)),
  }

  return {
    ok: true,
    config,
    diagnostics: diagnosticsFor(config),
  }
}

/** Same TLS handling as migrate: URL params for Supabase pooler certs, not pg strict verify. */
export function connectionStringWithSsl(config: OperatorDatabaseConfig): string {
  const sslEnabled = config.ssl?.rejectUnauthorized === true
  return sslEnabled ? enhanceDatabaseUrlForSsl(config.connectionString)! : config.connectionString
}

export function pgPoolConfigFromOperatorConfig(
  config: OperatorDatabaseConfig,
): Pick<PoolConfig, 'connectionString' | 'max' | 'ssl'> {
  return {
    connectionString: connectionStringWithSsl(config),
    max: config.max,
    ssl: undefined,
  }
}

const DIRECT_SUPABASE_HOST = /^db\.[a-z0-9]+\.supabase\.co$/i

export function isDirectSupabaseHost(host: string | undefined): boolean {
  return host !== undefined && DIRECT_SUPABASE_HOST.test(host)
}

export function operatorConnectionFailureHint(
  host: string | undefined,
  target: OperatorDatabaseTarget = 'production',
): string | undefined {
  if (!host || !DIRECT_SUPABASE_HOST.test(host)) {
    return undefined
  }

  const urlKey = TARGET_SPECS[target].urlKey

  return [
    `${urlKey} uses the Supabase direct host (db.*.supabase.co), which often does not resolve from a local machine.`,
    `Set the pooler/session connection string from the Supabase dashboard (Connect → Session or Transaction pooler) in ${urlKey}.`,
  ].join(' ')
}

function safeClassName(value: unknown): string {
  const className = value?.constructor?.name
  if (typeof className === 'string' && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(className)) {
    return className
  }

  return 'UnknownError'
}

function safeErrorCode(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'code' in value) {
    const code = (value as { code?: unknown }).code
    if (typeof code === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(code)) {
      return code
    }
  }

  return 'migration_unknown_error'
}

export function sanitizeMigrationError(error: unknown): SafeMigrationError {
  return {
    code: safeErrorCode(error),
    className: safeClassName(error),
    message: 'Migration failed. See sanitized diagnostics for the stable failure code.',
  }
}
