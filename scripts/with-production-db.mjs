/**
 * Runtime target switch for app commands (dev/build/start).
 *
 * The Next.js app reads DATABASE_URL only. To run an app command against the
 * production database WITHOUT editing .env, this wrapper loads .env, promotes
 * PRODUCTION_DATABASE_URL -> DATABASE_URL (and matching SSL flag), then spawns
 * the requested command. Next.js does not override env vars already present in
 * the process environment, so the promoted DATABASE_URL wins over the .env value.
 *
 * Usage: node scripts/with-production-db.mjs next dev
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

if (existsSync('.env')) {
  process.loadEnvFile('.env')
}

const productionUrl = process.env.PRODUCTION_DATABASE_URL
if (!productionUrl || productionUrl.trim() === '') {
  console.error('PRODUCTION_DATABASE_URL is required in .env for :production app commands.')
  process.exit(1)
}

const command = process.argv.slice(2)
if (command.length === 0) {
  console.error('No command provided. Usage: node scripts/with-production-db.mjs <command> [args...]')
  process.exit(1)
}

const env = {
  ...process.env,
  DATABASE_URL: productionUrl.trim(),
  DATABASE_SSL: process.env.PRODUCTION_DATABASE_SSL ?? 'true',
}

const child = spawn(command.join(' '), {
  stdio: 'inherit',
  shell: true,
  env,
})

child.on('exit', (code) => process.exit(code ?? 0))
