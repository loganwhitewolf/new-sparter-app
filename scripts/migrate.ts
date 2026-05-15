// Run locally with: yarn db:migrate
// Run production migrations explicitly with: yarn db:migrate:production
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { existsSync } from 'node:fs'
import { Pool } from 'pg'
import { getMigrationConfig, sanitizeMigrationError, type MigrationDiagnostics, type SafeMigrationError } from './migration-config'

// Load local env before validation (no server-only guard in scripts).
for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile)) {
    process.loadEnvFile?.(envFile)
  }
}

const MIGRATION_FAILURE_EXIT_CODE = 2
const VALIDATION_FAILURE_EXIT_CODE = 1

function selectedMode(): 'local' | 'production' {
  return process.argv.includes('--production') ? 'production' : 'local'
}

function safeStatusFields(diagnostics: MigrationDiagnostics) {
  return {
    targetClass: diagnostics.targetClass,
    migrationsFolder: diagnostics.migrationsFolder,
    sslEnabled: diagnostics.sslEnabled,
    poolMax: diagnostics.poolMax,
  }
}

function logMigrationEvent(event: 'migration_started' | 'migration_succeeded', diagnostics: MigrationDiagnostics) {
  console.log(JSON.stringify({ event, ...safeStatusFields(diagnostics) }))
}

function logMigrationFailure(diagnostics: MigrationDiagnostics, error: SafeMigrationError) {
  console.error(
    JSON.stringify({
      event: 'migration_failed',
      ...safeStatusFields(diagnostics),
      error: {
        code: error.code,
        className: error.className,
        message: error.message,
      },
    }),
  )
}

async function main() {
  const configResult = getMigrationConfig({ mode: selectedMode() })

  if (!configResult.ok) {
    console.error(
      JSON.stringify({
        event: 'migration_failed',
        targetClass: selectedMode(),
        error: configResult.error,
      }),
    )
    process.exitCode = VALIDATION_FAILURE_EXIT_CODE
    return
  }

  const { config, diagnostics } = configResult

  if (!config.connectionString) {
    logMigrationFailure(diagnostics, {
      code: 'missing_local_database_url',
      message: 'DATABASE_URL is required for local migrations.',
    })
    process.exitCode = VALIDATION_FAILURE_EXIT_CODE
    return
  }

  let pool: Pool | undefined

  try {
    logMigrationEvent('migration_started', diagnostics)

    pool = new Pool({
      connectionString: config.connectionString,
      max: config.max,
      ssl: config.ssl,
    })

    const db = drizzle(pool)
    await migrate(db, { migrationsFolder: config.migrationsFolder })

    logMigrationEvent('migration_succeeded', diagnostics)
  } catch (error) {
    logMigrationFailure(diagnostics, sanitizeMigrationError(error))
    process.exitCode = MIGRATION_FAILURE_EXIT_CODE
  } finally {
    if (pool) {
      await pool.end()
    }
  }
}

void main()
