// Run with: yarn db:migrate | db:migrate:staging | db:migrate:production (see scripts/db-config.ts)
import { execSync } from 'node:child_process'
import {
  connectionStringWithSsl,
  getOperatorDatabaseConfig,
  loadOperatorEnv,
  resolveOperatorDatabaseTarget,
  sanitizeMigrationError,
  type OperatorDatabaseDiagnostics,
  type SafeMigrationError,
} from './db-config'

loadOperatorEnv()

const migrationTarget = resolveOperatorDatabaseTarget()

const MIGRATION_FAILURE_EXIT_CODE = 2
const VALIDATION_FAILURE_EXIT_CODE = 1

function safeStatusFields(diagnostics: OperatorDatabaseDiagnostics) {
  return {
    target: diagnostics.target,
    migrationsFolder: diagnostics.migrationsFolder,
    sslEnabled: diagnostics.sslEnabled,
    poolMax: diagnostics.poolMax,
    host: diagnostics.host,
  }
}

function logMigrationEvent(
  event: 'migration_started' | 'migration_succeeded',
  diagnostics: OperatorDatabaseDiagnostics,
) {
  console.log(JSON.stringify({ event, ...safeStatusFields(diagnostics) }))
}

function logMigrationFailure(
  diagnostics: OperatorDatabaseDiagnostics,
  error: SafeMigrationError,
) {
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
  const configResult = getOperatorDatabaseConfig({ target: migrationTarget })

  if (!configResult.ok) {
    console.error(
      JSON.stringify({
        event: 'migration_failed',
        target: migrationTarget,
        error: configResult.error,
      }),
    )
    process.exitCode = VALIDATION_FAILURE_EXIT_CODE
    return
  }

  const { config, diagnostics } = configResult

  try {
    logMigrationEvent('migration_started', diagnostics)

    const env = {
      ...process.env,
      DATABASE_URL: connectionStringWithSsl(config),
    }

    const result = execSync('yarn drizzle-kit migrate 2>&1', {
      env,
      encoding: 'utf8',
    })
    if (process.env.MIGRATION_DEBUG === '1') {
      process.stdout.write(result)
    }

    logMigrationEvent('migration_succeeded', diagnostics)
  } catch (error) {
    if (process.env.MIGRATION_DEBUG === '1') {
      const execError = error as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string }
      const output = (execError?.stdout?.toString() ?? '') + (execError?.stderr?.toString() ?? '')
      console.error('RAW_ERROR:', JSON.stringify({ msg: execError?.message, output }))
    }
    logMigrationFailure(diagnostics, sanitizeMigrationError(error))
    process.exitCode = MIGRATION_FAILURE_EXIT_CODE
  }
}

void main()
