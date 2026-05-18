// Run locally with: yarn db:migrate
// Run production migrations explicitly with: yarn db:migrate:production
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { enhanceDatabaseUrlForSsl } from "../lib/db/config";
import {
  getMigrationConfig,
  sanitizeMigrationError,
  type MigrationDiagnostics,
  type SafeMigrationError,
} from "./migration-config";

// Load local env before validation (no server-only guard in scripts).
for (const envFile of [".env.local", ".env"]) {
  if (existsSync(envFile)) {
    process.loadEnvFile?.(envFile);
  }
}

const MIGRATION_FAILURE_EXIT_CODE = 2;
const VALIDATION_FAILURE_EXIT_CODE = 1;

function selectedMode(): "local" | "production" {
  return process.argv.includes("--production") ? "production" : "local";
}

function safeStatusFields(diagnostics: MigrationDiagnostics) {
  return {
    targetClass: diagnostics.targetClass,
    migrationsFolder: diagnostics.migrationsFolder,
    sslEnabled: diagnostics.sslEnabled,
    poolMax: diagnostics.poolMax,
  };
}

function logMigrationEvent(
  event: "migration_started" | "migration_succeeded",
  diagnostics: MigrationDiagnostics,
) {
  console.log(JSON.stringify({ event, ...safeStatusFields(diagnostics) }));
}

function logMigrationFailure(
  diagnostics: MigrationDiagnostics,
  error: SafeMigrationError,
) {
  console.error(
    JSON.stringify({
      event: "migration_failed",
      ...safeStatusFields(diagnostics),
      error: {
        code: error.code,
        className: error.className,
        message: error.message,
      },
    }),
  );
}

async function main() {
  const configResult = getMigrationConfig({ mode: selectedMode() });

  if (!configResult.ok) {
    console.error(
      JSON.stringify({
        event: "migration_failed",
        targetClass: selectedMode(),
        error: configResult.error,
      }),
    );
    process.exitCode = VALIDATION_FAILURE_EXIT_CODE;
    return;
  }

  const { config, diagnostics } = configResult;

  if (!config.connectionString) {
    logMigrationFailure(diagnostics, {
      code: "missing_local_database_url",
      message: "DATABASE_URL is required for local migrations.",
    });
    process.exitCode = VALIDATION_FAILURE_EXIT_CODE;
    return;
  }

  try {
    logMigrationEvent("migration_started", diagnostics);

    // drizzle-kit reads DATABASE_URL from drizzle.config.ts; mirror runtime TLS URL params.
    const sslEnabled = config.ssl?.rejectUnauthorized === true;
    const connectionStringWithSsl = sslEnabled
      ? enhanceDatabaseUrlForSsl(config.connectionString)
      : config.connectionString;

    const env = {
      ...process.env,
      DATABASE_URL: connectionStringWithSsl,
    };

    const result = execSync("npx drizzle-kit migrate 2>&1", {
      env,
      encoding: "utf8",
    });
    if (process.env.MIGRATION_DEBUG === "1") {
      process.stdout.write(result);
    }

    logMigrationEvent("migration_succeeded", diagnostics);
  } catch (error) {
    if (process.env.MIGRATION_DEBUG === "1") {
      const execError = error as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
      const output = (execError?.stdout?.toString() ?? "") + (execError?.stderr?.toString() ?? "");
      console.error("RAW_ERROR:", JSON.stringify({ msg: execError?.message, output }));
    }
    logMigrationFailure(diagnostics, sanitizeMigrationError(error));
    process.exitCode = MIGRATION_FAILURE_EXIT_CODE;
  }
}

void main();
