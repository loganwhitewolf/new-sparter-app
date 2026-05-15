#!/usr/bin/env node

const EXIT_UNEXPECTED = 1
const EXIT_CONFIG = 2
const EXIT_HEALTH = 3
const EXIT_SIGNUP = 4

const DEFAULT_TIMEOUT_MS = 5_000
const MAX_REPORTED_LATENCY_MS = 60_000
const SIGNUP_PATH = '/api/auth/sign-up/email'
const HEALTH_PATH = '/api/health'

function parseArgs(argv) {
  const options = {
    origin: process.env.PRODUCTION_SMOKE_ORIGIN,
    expectDisabledSignup: false,
    checkEnv: false,
    localTestMode: process.env.PRODUCTION_SMOKE_LOCAL_TEST_MODE === 'true',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--origin') {
      options.origin = argv[index + 1]
      index += 1
      continue
    }
    if (arg.startsWith('--origin=')) {
      options.origin = arg.slice('--origin='.length)
      continue
    }
    if (arg === '--expect-disabled-signup') {
      options.expectDisabledSignup = true
      continue
    }
    if (arg === '--check-env') {
      options.checkEnv = true
      continue
    }
    if (arg === '--local-test-mode') {
      options.localTestMode = true
      continue
    }
    if (arg === '--timeout-ms') {
      options.timeoutMs = Number(argv[index + 1])
      index += 1
      continue
    }
    if (arg.startsWith('--timeout-ms=')) {
      options.timeoutMs = Number(arg.slice('--timeout-ms='.length))
      continue
    }

    throw Object.assign(new Error('Unknown argument'), { code: 'unknown_argument' })
  }

  return options
}

function isLocalHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.localhost')
}

function normalizeOrigin(rawOrigin, { localTestMode }) {
  if (!rawOrigin || rawOrigin.trim() === '') {
    return { ok: false, code: 'missing_origin' }
  }

  let parsed
  try {
    parsed = new URL(rawOrigin)
  } catch {
    return { ok: false, code: 'invalid_origin' }
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, code: 'invalid_origin_protocol' }
  }
  if (!localTestMode && parsed.protocol !== 'https:') {
    return { ok: false, code: 'non_https_origin' }
  }
  if ((parsed.username || parsed.password) || parsed.search || parsed.hash) {
    return { ok: false, code: 'origin_must_not_include_credentials_query_or_fragment' }
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    return { ok: false, code: 'origin_must_not_include_path' }
  }
  if (isLocalHostname(parsed.hostname) && !localTestMode) {
    return { ok: false, code: 'localhost_requires_local_test_mode' }
  }

  return { ok: true, origin: parsed.origin }
}

function boundedLatency(startedAt) {
  return Math.min(Date.now() - startedAt, MAX_REPORTED_LATENCY_MS)
}

function writeEvent(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`)
}

function safeComponent(name, value) {
  const result = { name, ok: value && typeof value.ok === 'boolean' ? value.ok : false }

  if (typeof value?.code === 'string') {
    result.code = value.code
  }
  if (Array.isArray(value?.missing)) {
    result.missing = value.missing.filter((item) => typeof item === 'string').slice(0, 20)
  }
  if (typeof value?.latencyMs === 'number' && Number.isFinite(value.latencyMs)) {
    result.latencyMs = Math.max(0, Math.min(Math.round(value.latencyMs), MAX_REPORTED_LATENCY_MS))
  }

  return result
}

function sanitizeHealthBody(body) {
  const components = body && typeof body === 'object' && body.components && typeof body.components === 'object'
    ? body.components
    : undefined
  const componentNames = components ? Object.keys(components).filter((name) => /^[a-z0-9_-]{1,32}$/i.test(name)).sort() : []

  return {
    status: typeof body?.status === 'string' ? body.status : 'unknown',
    components: componentNames.map((name) => safeComponent(name, components[name])),
  }
}

async function fetchJson(url, init, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    })
    const text = await response.text()
    let body
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      return {
        ok: false,
        code: 'malformed_response',
        httpStatus: response.status,
        latencyMs: boundedLatency(startedAt),
      }
    }

    return {
      ok: true,
      httpStatus: response.status,
      body,
      latencyMs: boundedLatency(startedAt),
    }
  } catch (error) {
    return {
      ok: false,
      code: error?.name === 'AbortError' ? 'timeout' : 'network_error',
      latencyMs: boundedLatency(startedAt),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function generatedSignupBody() {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return {
    name: 'Production Smoke',
    email: `production-smoke-${nonce}@example.invalid`,
    password: `Smoke-${nonce}-Password!`,
  }
}

async function runHealth(origin, timeoutMs) {
  const result = await fetchJson(`${origin}${HEALTH_PATH}`, { method: 'GET' }, timeoutMs)

  if (!result.ok) {
    writeEvent({
      phase: 'health',
      ok: false,
      code: result.code,
      ...(typeof result.httpStatus === 'number' ? { httpStatus: result.httpStatus } : {}),
      latencyMs: result.latencyMs,
    })
    return false
  }

  const health = sanitizeHealthBody(result.body)
  const componentOk = health.components.length > 0 && health.components.every((component) => component.ok === true)
  const pass = result.httpStatus === 200 && health.status === 'ok' && componentOk

  writeEvent({
    phase: 'health',
    ok: pass,
    httpStatus: result.httpStatus,
    status: health.status,
    components: health.components,
    latencyMs: result.latencyMs,
  })

  return pass
}

async function runDisabledSignup(origin, timeoutMs) {
  const result = await fetchJson(
    `${origin}${SIGNUP_PATH}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generatedSignupBody()),
    },
    timeoutMs,
  )

  if (!result.ok) {
    writeEvent({
      phase: 'disabled_signup',
      ok: false,
      code: result.code,
      ...(typeof result.httpStatus === 'number' ? { httpStatus: result.httpStatus } : {}),
      latencyMs: result.latencyMs,
    })
    return false
  }

  const code = typeof result.body?.error?.code === 'string' ? result.body.error.code : 'missing_error_code'
  const pass = result.httpStatus === 403 && code === 'registration_disabled'

  writeEvent({
    phase: 'disabled_signup',
    ok: pass,
    httpStatus: result.httpStatus,
    errorCode: code,
    latencyMs: result.latencyMs,
  })

  return pass
}

async function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    writeEvent({ phase: 'config', ok: false, code: error.code ?? 'invalid_arguments' })
    return EXIT_CONFIG
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 100 || options.timeoutMs > 30_000) {
    writeEvent({ phase: 'config', ok: false, code: 'invalid_timeout_ms' })
    return EXIT_CONFIG
  }

  const originResult = normalizeOrigin(options.origin, options)

  if (options.checkEnv) {
    writeEvent({
      phase: 'check_env',
      ok: originResult.ok,
      originConfigured: originResult.ok,
      ...(originResult.ok ? {} : { code: originResult.code }),
      expectDisabledSignup: options.expectDisabledSignup,
      localTestMode: options.localTestMode,
    })
    return 0
  }

  if (!originResult.ok) {
    writeEvent({ phase: 'config', ok: false, code: originResult.code })
    return EXIT_CONFIG
  }

  const healthOk = await runHealth(originResult.origin, Math.round(options.timeoutMs))
  if (!healthOk) {
    return EXIT_HEALTH
  }

  if (options.expectDisabledSignup) {
    const signupOk = await runDisabledSignup(originResult.origin, Math.round(options.timeoutMs))
    if (!signupOk) {
      return EXIT_SIGNUP
    }
  }

  writeEvent({ phase: 'summary', ok: true })
  return 0
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode
  })
  .catch(() => {
    writeEvent({ phase: 'runtime', ok: false, code: 'unexpected_runtime_error' })
    process.exitCode = EXIT_UNEXPECTED
  })
