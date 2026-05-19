/** Shared operator DB config for yarn db:migrate and yarn db:seed (PRODUCTION_* in .env). */
import { existsSync } from 'node:fs'
import type { PoolConfig } from 'pg'
import { enhanceDatabaseUrlForSsl } from '../lib/db/config'

export const OPERATOR_ENV_FILE = '.env'
export const DEFAULT_MIGRATIONS_FOLDER = './drizzle/migrations'
export const DEFAULT_OPERATOR_POOL_MAX = 1
export const MAX_OPERATOR_POOL_MAX = 2
export const PRODUCTION_MIGRATION_CONFIRM_VALUE = 'apply-to-production'

export type OperatorDatabaseEnv = {
  PRODUCTION_DATABASE_URL?: string
  PRODUCTION_DATABASE_SSL?: string
  PRODUCTION_DATABASE_POOL_MAX?: string
  PRODUCTION_MIGRATION_CONFIRM?: string
}

export type OperatorSslConfig = {
  rejectUnauthorized: true
}

export type OperatorDatabaseConfig = {
  targetClass: 'production'
  connectionString: string
  migrationsFolder: string
  max: number
  ssl?: OperatorSslConfig
}

export type OperatorDatabaseDiagnostics = {
  targetClass: 'production'
  migrationsFolder: string
  poolMax: number
  sslEnabled: boolean
  host: string | undefined
}

export type OperatorValidationErrorCode =
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
  env?: OperatorDatabaseEnv
  migrationsFolder?: string
}

/** Operator migrate/seed scripts read secrets from .env only (not .env.local). */
export function loadOperatorEnv(): void {
  if (existsSync(OPERATOR_ENV_FILE)) {
    process.loadEnvFile?.(OPERATOR_ENV_FILE)
  }
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
    targetClass: config.targetClass,
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
      message: `Set PRODUCTION_MIGRATION_CONFIRM=${PRODUCTION_MIGRATION_CONFIRM_VALUE} in ${OPERATOR_ENV_FILE} to run operator database commands.`,
    }
  }

  if (value !== PRODUCTION_MIGRATION_CONFIRM_VALUE) {
    return {
      code: 'invalid_production_migration_confirm',
      message: `Set PRODUCTION_MIGRATION_CONFIRM=${PRODUCTION_MIGRATION_CONFIRM_VALUE} in ${OPERATOR_ENV_FILE} to run operator database commands.`,
    }
  }

  return undefined
}

export function getOperatorDatabaseConfig(
  options: GetOperatorDatabaseConfigOptions = {},
): OperatorDatabaseConfigResult {
  const env = options.env ?? (process.env as OperatorDatabaseEnv)
  const migrationsFolder = options.migrationsFolder ?? DEFAULT_MIGRATIONS_FOLDER

  if (isBlank(env.PRODUCTION_DATABASE_URL)) {
    return {
      ok: false,
      error: {
        code: 'missing_production_database_url',
        message: `PRODUCTION_DATABASE_URL is required in ${OPERATOR_ENV_FILE} for operator database commands.`,
      },
    }
  }

  const confirmationError = productionConfirmationError(env.PRODUCTION_MIGRATION_CONFIRM)
  if (confirmationError) {
    return { ok: false, error: confirmationError }
  }

  const connectionString = env.PRODUCTION_DATABASE_URL!.trim()

  const config: OperatorDatabaseConfig = {
    targetClass: 'production',
    connectionString,
    migrationsFolder,
    max: parseOperatorPoolMax(env.PRODUCTION_DATABASE_POOL_MAX),
    ssl: strictSsl(env.PRODUCTION_DATABASE_SSL),
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

export function operatorConnectionFailureHint(host: string | undefined): string | undefined {
  if (!host || !DIRECT_SUPABASE_HOST.test(host)) {
    return undefined
  }

  return [
    'PRODUCTION_DATABASE_URL uses the Supabase direct host (db.*.supabase.co), which often does not resolve from a local machine.',
    'Set the pooler/session connection string from the Supabase dashboard (Connect → Session or Transaction pooler) in PRODUCTION_DATABASE_URL.',
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
