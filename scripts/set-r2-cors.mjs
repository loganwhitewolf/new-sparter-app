#!/usr/bin/env node
/**
 * Set a Cloudflare R2 bucket CORS policy for browser PUT uploads.
 *
 * Production usage requires a concrete deployed HTTPS origin:
 *   R2_CORS_ALLOWED_ORIGIN=https://app.example.com CLOUDFLARE_API_TOKEN=<token> node scripts/set-r2-cors.mjs
 *
 * Local development may use localhost only when explicitly enabled:
 *   R2_CORS_DEV_MODE=true R2_CORS_ALLOWED_ORIGIN=http://localhost:3000 CLOUDFLARE_API_TOKEN=<token> node scripts/set-r2-cors.mjs
 *
 * Required environment variable names:
 *   CLOUDFLARE_API_TOKEN, R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_CORS_ALLOWED_ORIGIN
 *
 * The token needs R2:Edit permission on the target account/bucket. This helper
 * intentionally prints only bounded phase/code/status lines and never prints
 * account IDs, tokens, bucket names, origins from provider errors, raw provider
 * payloads, request bodies, object keys, stack traces, or presigned URLs.
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))

export const R2_CORS_ALLOWED_METHODS = ['PUT']
export const R2_CORS_ALLOWED_HEADERS = ['Content-Type']
export const R2_CORS_EXPOSE_HEADERS = []
export const R2_CORS_MAX_AGE_SECONDS = 3000

const REQUIRED_ENV_VARS = ['CLOUDFLARE_API_TOKEN', 'R2_ACCOUNT_ID', 'R2_BUCKET_NAME', 'R2_CORS_ALLOWED_ORIGIN']
const SAFE_ERROR_CODES = new Set([
  'missing_env',
  'invalid_origin_empty',
  'invalid_origin_wildcard',
  'invalid_origin_protocol',
  'invalid_origin_localhost_production',
  'cf_network_error',
  'cf_http_error',
  'cf_api_error',
  'cf_malformed_response',
])

// Load env from .env file (simple parser — no dotenv dependency needed).
export function loadEnv(env = process.env) {
  try {
    const content = readFileSync(join(__dir, '..', '.env'), 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (!(key in env)) env[key] = val
    }
  } catch {
    // .env not found — rely on environment variables.
  }
}

function isEnabled(value) {
  return ['true', '1', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase())
}

function isLocalhost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

export class R2CorsError extends Error {
  constructor(code, message, status) {
    super(message)
    this.name = 'R2CorsError'
    this.code = SAFE_ERROR_CODES.has(code) ? code : 'cf_api_error'
    this.status = status
  }
}

export function validateAllowedOrigin(origin, options = {}) {
  const devMode = Boolean(options.devMode)
  const normalized = String(origin ?? '').trim().replace(/\/$/, '')

  if (!normalized) {
    throw new R2CorsError('invalid_origin_empty', 'R2_CORS_ALLOWED_ORIGIN must be set to one concrete origin.')
  }
  if (normalized === '*') {
    throw new R2CorsError('invalid_origin_wildcard', 'Wildcard origins are not allowed for R2 browser uploads.')
  }

  let parsed
  try {
    parsed = new URL(normalized)
  } catch {
    throw new R2CorsError('invalid_origin_protocol', 'R2_CORS_ALLOWED_ORIGIN must be an HTTP(S) origin.')
  }

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new R2CorsError('invalid_origin_protocol', 'R2_CORS_ALLOWED_ORIGIN must use HTTP(S).')
  }

  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new R2CorsError('invalid_origin_protocol', 'R2_CORS_ALLOWED_ORIGIN must contain only scheme, host, and optional port.')
  }

  if (!devMode && (parsed.protocol !== 'https:' || isLocalhost(parsed.hostname))) {
    throw new R2CorsError(
      'invalid_origin_localhost_production',
      'Production R2 CORS requires a deployed HTTPS origin. Use R2_CORS_DEV_MODE=true only for local development.',
    )
  }

  if (devMode && parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new R2CorsError('invalid_origin_protocol', 'Development R2 CORS origins must still use HTTP(S).')
  }

  return parsed.origin
}

export function buildR2CorsPolicy(origin, options = {}) {
  const allowedOrigin = validateAllowedOrigin(origin, options)

  return {
    rules: [
      {
        allowed: {
          origins: [allowedOrigin],
          methods: [...R2_CORS_ALLOWED_METHODS],
          headers: [...R2_CORS_ALLOWED_HEADERS],
        },
        exposeHeaders: [...R2_CORS_EXPOSE_HEADERS],
        maxAgeSeconds: R2_CORS_MAX_AGE_SECONDS,
      },
    ],
  }
}

export function validateRequiredEnv(env) {
  return REQUIRED_ENV_VARS.filter((name) => !String(env[name] ?? '').trim())
}

export function safeStatusLine(event, fields = {}) {
  const code = SAFE_ERROR_CODES.has(fields.code) ? fields.code : undefined
  const status = Number.isInteger(fields.status) ? fields.status : undefined
  const output = { event }
  if (fields.phase) output.phase = fields.phase
  if (code) output.code = code
  if (status) output.status = status
  return JSON.stringify(output)
}

function normalizeProviderFailure(response, result) {
  if (!response.ok) {
    return new R2CorsError('cf_http_error', 'Cloudflare R2 CORS update failed.', response.status)
  }
  if (!result || typeof result !== 'object' || result.success !== true) {
    return new R2CorsError('cf_api_error', 'Cloudflare R2 CORS update was not accepted.', response.status)
  }
  return null
}

export async function setR2Cors({ env = process.env, fetchImpl = fetch, stdout = console.log, stderr = console.error } = {}) {
  const missing = validateRequiredEnv(env)
  if (missing.length > 0) {
    stderr(safeStatusLine('r2_cors_failed', { phase: 'validate_env', code: 'missing_env' }))
    throw new R2CorsError('missing_env', `Missing required environment variables: ${missing.join(', ')}`)
  }

  const policy = buildR2CorsPolicy(env.R2_CORS_ALLOWED_ORIGIN, { devMode: isEnabled(env.R2_CORS_DEV_MODE) })
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.R2_ACCOUNT_ID}/r2/buckets/${env.R2_BUCKET_NAME}/cors`

  stdout(safeStatusLine('r2_cors_started', { phase: 'update_cors' }))

  let response
  try {
    response = await fetchImpl(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(policy),
    })
  } catch {
    stderr(safeStatusLine('r2_cors_failed', { phase: 'update_cors', code: 'cf_network_error' }))
    throw new R2CorsError('cf_network_error', 'Cloudflare R2 CORS update could not reach the provider.')
  }

  let result
  try {
    result = await response.json()
  } catch {
    stderr(safeStatusLine('r2_cors_failed', {
      phase: 'update_cors',
      code: 'cf_malformed_response',
      status: response.status,
    }))
    throw new R2CorsError('cf_malformed_response', 'Cloudflare R2 CORS update returned malformed JSON.', response.status)
  }

  const providerError = normalizeProviderFailure(response, result)
  if (providerError) {
    stderr(safeStatusLine('r2_cors_failed', {
      phase: 'update_cors',
      code: providerError.code,
      status: providerError.status,
    }))
    throw providerError
  }

  stdout(safeStatusLine('r2_cors_succeeded', { phase: 'update_cors', status: response.status }))
  return { policy, status: response.status }
}

async function main() {
  loadEnv()
  try {
    await setR2Cors()
  } catch (error) {
    if (error instanceof R2CorsError && error.code.startsWith('invalid_origin_')) {
      console.error(safeStatusLine('r2_cors_failed', { phase: 'validate_origin', code: error.code }))
    }
    process.exitCode = 1
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main()
}
