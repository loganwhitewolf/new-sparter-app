export const DEFAULT_MIGRATIONS_FOLDER = './drizzle/migrations'
export const DEFAULT_MIGRATION_POOL_MAX = 1
export const DEFAULT_PRODUCTION_MIGRATION_POOL_MAX = 1
export const MAX_PRODUCTION_MIGRATION_POOL_MAX = 2
export const PRODUCTION_MIGRATION_CONFIRM_VALUE = 'apply-to-production'

export type MigrationMode = 'local' | 'production'
export type MigrationTargetClass = MigrationMode

export type MigrationConfigEnv = {
  DATABASE_URL?: string
  DATABASE_SSL?: string
  DATABASE_POOL_MAX?: string
  PRODUCTION_DATABASE_URL?: string
  PRODUCTION_DATABASE_SSL?: string
  PRODUCTION_DATABASE_POOL_MAX?: string
  PRODUCTION_MIGRATION_CONFIRM?: string
}

export type MigrationSslConfig = {
  rejectUnauthorized: true
}

export type MigrationConfig = {
  targetClass: MigrationTargetClass
  connectionString: string | undefined
  migrationsFolder: string
  max: number
  ssl?: MigrationSslConfig
}

export type MigrationDiagnostics = {
  targetClass: MigrationTargetClass
  migrationsFolder: string
  poolMax: number
  sslEnabled: boolean
}

export type MigrationValidationErrorCode =
  | 'missing_production_database_url'
  | 'missing_production_migration_confirm'
  | 'invalid_production_migration_confirm'

export type SafeMigrationErrorCode = MigrationValidationErrorCode | 'migration_unknown_error' | string

export type SafeMigrationError = {
  code: SafeMigrationErrorCode
  message: string
  className?: string
}

export type MigrationConfigResult =
  | {
      ok: true
      config: MigrationConfig
      diagnostics: MigrationDiagnostics
    }
  | {
      ok: false
      error: SafeMigrationError
    }

export type GetMigrationConfigOptions = {
  mode?: MigrationMode
  env?: MigrationConfigEnv
  migrationsFolder?: string
}

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === ''
}

function parseMigrationPoolMax(value: string | undefined, defaultValue: number, maxValue: number): number {
  if (isBlank(value)) {
    return defaultValue
  }

  const trimmed = value?.trim() ?? ''
  if (!/^\d+$/.test(trimmed)) {
    return defaultValue
  }

  const parsed = Number(trimmed)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return defaultValue
  }

  return Math.min(parsed, maxValue)
}

function strictSsl(enabled: string | undefined): MigrationSslConfig | undefined {
  return enabled === 'true' ? { rejectUnauthorized: true } : undefined
}

function diagnosticsFor(config: MigrationConfig): MigrationDiagnostics {
  return {
    targetClass: config.targetClass,
    migrationsFolder: config.migrationsFolder,
    poolMax: config.max,
    sslEnabled: config.ssl?.rejectUnauthorized === true,
  }
}

function productionConfirmationError(value: string | undefined): SafeMigrationError | undefined {
  if (value === undefined || value.trim() === '') {
    return {
      code: 'missing_production_migration_confirm',
      message: `Set PRODUCTION_MIGRATION_CONFIRM=${PRODUCTION_MIGRATION_CONFIRM_VALUE} to run production migrations.`,
    }
  }

  if (value !== PRODUCTION_MIGRATION_CONFIRM_VALUE) {
    return {
      code: 'invalid_production_migration_confirm',
      message: `Set PRODUCTION_MIGRATION_CONFIRM=${PRODUCTION_MIGRATION_CONFIRM_VALUE} to run production migrations.`,
    }
  }

  return undefined
}

export function getMigrationConfig(options: GetMigrationConfigOptions = {}): MigrationConfigResult {
  const mode = options.mode ?? 'local'
  const env = options.env ?? (process.env as MigrationConfigEnv)
  const migrationsFolder = options.migrationsFolder ?? DEFAULT_MIGRATIONS_FOLDER

  if (mode === 'production') {
    if (isBlank(env.PRODUCTION_DATABASE_URL)) {
      return {
        ok: false,
        error: {
          code: 'missing_production_database_url',
          message: 'PRODUCTION_DATABASE_URL is required for production migrations.',
        },
      }
    }

    const confirmationError = productionConfirmationError(env.PRODUCTION_MIGRATION_CONFIRM)
    if (confirmationError) {
      return { ok: false, error: confirmationError }
    }

    const config: MigrationConfig = {
      targetClass: 'production',
      connectionString: env.PRODUCTION_DATABASE_URL,
      migrationsFolder,
      max: parseMigrationPoolMax(
        env.PRODUCTION_DATABASE_POOL_MAX,
        DEFAULT_PRODUCTION_MIGRATION_POOL_MAX,
        MAX_PRODUCTION_MIGRATION_POOL_MAX,
      ),
      ssl: strictSsl(env.PRODUCTION_DATABASE_SSL),
    }

    return {
      ok: true,
      config,
      diagnostics: diagnosticsFor(config),
    }
  }

  const config: MigrationConfig = {
    targetClass: 'local',
    connectionString: env.DATABASE_URL,
    migrationsFolder,
    max: parseMigrationPoolMax(env.DATABASE_POOL_MAX, DEFAULT_MIGRATION_POOL_MAX, DEFAULT_MIGRATION_POOL_MAX),
    ssl: strictSsl(env.DATABASE_SSL),
  }

  return {
    ok: true,
    config,
    diagnostics: diagnosticsFor(config),
  }
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
