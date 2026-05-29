import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

const SCRIPT_PATH = new URL('../scripts/production-smoke.mjs', import.meta.url).pathname
const FORBIDDEN_OUTPUT_PATTERNS = [
  /postgres:\/\//i,
  /super-secret/i,
  /Cookie/i,
  /session=/i,
  /password/i,
  /production-smoke-[^\s"]+@example\.invalid/i,
  /X-Amz-Signature/i,
  /request body/i,
  /at .*production-smoke\.mjs:\d+:\d+/i,
]

type Handler = (request: IncomingMessage, response: ServerResponse) => void | Promise<void>
type SmokeRun = { exitCode: number | null; stdout: string; stderr: string; events: Array<Record<string, unknown>> }

const servers: Array<ReturnType<typeof createServer>> = []

async function startServer(handler: Handler) {
  const server = createServer((request, response) => {
    void Promise.resolve(handler(request, response)).catch(() => {
      response.writeHead(500, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: { code: 'handler_failed' } }))
    })
  })
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Expected TCP server address')
  }
  return { origin: `http://127.0.0.1:${address.port}` }
}

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Set-Cookie': 'session=super-secret-cookie' })
  response.end(JSON.stringify(body))
}

async function runSmoke(args: string[], env: Partial<NodeJS.ProcessEnv> = {}): Promise<SmokeRun> {
  const child = spawn(process.execPath, [SCRIPT_PATH, ...args], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  const [exitCode] = await once(child, 'exit') as [number | null]
  const events = stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>)

  return { exitCode, stdout, stderr, events }
}

function expectNoForbiddenOutput(output: string) {
  for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
    expect(output).not.toMatch(pattern)
  }
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
    ),
  )
})

describe('production-smoke CLI config validation', () => {
  it('supports no-secret check-env mode without an origin', async () => {
    const run = await runSmoke(['--check-env'])

    expect(run.exitCode).toBe(0)
    expect(run.events).toEqual([
      expect.objectContaining({
        phase: 'check_env',
        ok: false,
        originConfigured: false,
        code: 'missing_origin',
      }),
    ])
    expect(run.stderr).toBe('')
    expectNoForbiddenOutput(run.stdout + run.stderr)
  })

  it('rejects missing, credentialed, query, fragment, and localhost origins without leaking them', async () => {
    const cases = [
      { args: [], code: 'missing_origin' },
      { args: ['--origin', 'https://user:super-secret@example.com'], code: 'origin_must_not_include_credentials_query_or_fragment' },
      { args: ['--origin', 'https://example.com?X-Amz-Signature=super-secret'], code: 'origin_must_not_include_credentials_query_or_fragment' },
      { args: ['--origin', 'https://example.com/#super-secret'], code: 'origin_must_not_include_credentials_query_or_fragment' },
      { args: ['--origin', 'http://localhost:3000'], code: 'non_https_origin' },
    ]

    for (const testCase of cases) {
      const run = await runSmoke(testCase.args)
      expect(run.exitCode).toBe(2)
      expect(run.events[0]).toEqual(expect.objectContaining({ phase: 'config', ok: false, code: testCase.code }))
      expect(run.stderr).toBe('')
      expectNoForbiddenOutput(run.stdout + run.stderr)
    }
  })
})

describe('production-smoke CLI health phase', () => {
  it('fails safely for health HTTP 500 with sanitized component codes', async () => {
    const { origin } = await startServer((_request, response) => {
      json(response, 500, {
        status: 'degraded',
        components: {
          db: { ok: false, code: 'database_unreachable', latencyMs: 12, rawError: 'postgres://super-secret' },
          r2: { ok: false, missing: ['R2_ACCESS_KEY_ID'], secret: 'super-secret' },
        },
      })
    })

    const run = await runSmoke(['--origin', origin, '--local-test-mode'])

    expect(run.exitCode).toBe(3)
    expect(run.events).toEqual([
      expect.objectContaining({
        phase: 'health',
        ok: false,
        httpStatus: 500,
        status: 'degraded',
        components: expect.arrayContaining([
          expect.objectContaining({ name: 'db', ok: false, code: 'database_unreachable', latencyMs: 12 }),
          expect.objectContaining({ name: 'r2', ok: false, missing: ['R2_ACCESS_KEY_ID'] }),
        ]),
      }),
    ])
    expectNoForbiddenOutput(run.stdout + run.stderr)
  })

  it('fails safely for malformed health JSON', async () => {
    const { origin } = await startServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end('{not json with super-secret password}')
    })

    const run = await runSmoke(['--origin', origin, '--local-test-mode'])

    expect(run.exitCode).toBe(3)
    expect(run.events).toEqual([
      expect.objectContaining({ phase: 'health', ok: false, httpStatus: 200, code: 'malformed_response' }),
    ])
    expectNoForbiddenOutput(run.stdout + run.stderr)
  })
})
