import pino from 'pino'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  headers: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: mocks.headers,
}))

vi.mock('@/auth', () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
    },
  },
}))

const {
  DEFAULT_BETTERSTACK_ENDPOINT,
  buildTransportConfig,
  createLoggerOptions,
  getLogContext,
  logger,
  withLogContext,
  withUserId,
} = await import('../lib/logger')

function writeOnce(options: pino.LoggerOptions, payload: Record<string, unknown>) {
  let line = ''
  const stream = {
    write(chunk: string) {
      line += chunk
    },
  }

  pino({ ...options, transport: undefined, timestamp: false }, stream).info(payload, 'sample')

  return JSON.parse(line) as Record<string, unknown>
}

function requestHeaders(values: Record<string, string> = {}) {
  return new Headers(values)
}

beforeEach(() => {
  vi.unstubAllEnvs()
  mocks.getSession.mockReset()
  mocks.headers.mockReset()
  mocks.headers.mockResolvedValue(requestHeaders())
  mocks.getSession.mockResolvedValue(null)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('logger configuration', () => {
  it('uses development pretty output with colorized translated time and noisy bindings ignored', () => {
    const transport = buildTransportConfig({ NODE_ENV: 'development' })

    expect(transport).toEqual({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    })
  })

  it('uses JSON stdout without transport when production has no Better Stack token', () => {
    const options = createLoggerOptions({ NODE_ENV: 'production' })

    expect(options.transport).toBeUndefined()
    expect(options.level).toBe('info')
  })

  it('activates Better Stack multi-target output when a source token is present', () => {
    const transport = buildTransportConfig({
      NODE_ENV: 'production',
      BETTERSTACK_SOURCE_TOKEN: 'bst_test_source_token',
    })

    expect(transport).toEqual({
      targets: [
        {
          target: '@logtail/pino',
          options: {
            sourceToken: 'bst_test_source_token',
            options: {
              endpoint: DEFAULT_BETTERSTACK_ENDPOINT,
            },
          },
        },
        {
          target: 'pino/file',
          options: {
            destination: 1,
          },
        },
      ],
    })
    expect(() => structuredClone(transport)).not.toThrow()
  })

  it('preserves stdout and supports overriding the Better Stack ingest endpoint', () => {
    const transport = buildTransportConfig({
      NODE_ENV: 'production',
      BETTERSTACK_SOURCE_TOKEN: 'bst_test_source_token',
      BETTERSTACK_INGESTING_URL: 'https://example.test/logs',
    })

    expect(transport).toMatchObject({
      targets: expect.arrayContaining([
        {
          target: '@logtail/pino',
          options: {
            sourceToken: 'bst_test_source_token',
            options: {
              endpoint: 'https://example.test/logs',
            },
          },
        },
        {
          target: 'pino/file',
          options: {
            destination: 1,
          },
        },
      ]),
    })
  })

  it('redacts token-like fields and presigned URL query strings from emitted sample records', () => {
    const emitted = writeOnce(createLoggerOptions({ NODE_ENV: 'production' }), {
      token: 'plain-token-value',
      sourceToken: 'bst_test_source_token',
      BETTERSTACK_SOURCE_TOKEN: 'bst_test_source_token',
      headers: {
        authorization: 'Bearer auth-secret',
      },
      uploadUrl: 'https://r2.example.test/object.csv?X-Amz-Signature=abc123&X-Amz-Credential=secret',
      nested: {
        url: 'https://r2.example.test/object.csv?X-Amz-Signature=abc123',
      },
    })

    const serialized = JSON.stringify(emitted)

    expect(serialized).not.toContain('plain-token-value')
    expect(serialized).not.toContain('bst_test_source_token')
    expect(serialized).not.toContain('auth-secret')
    expect(serialized).not.toContain('X-Amz-Signature')
    expect(serialized).toContain('https://r2.example.test/object.csv?[Redacted]')
  })

  it('adds request-scoped context from AsyncLocalStorage to emitted records', () => {
    const emitted = withLogContext({ requestId: 'req-123', userId: 'user-123' }, () =>
      writeOnce(createLoggerOptions({ NODE_ENV: 'production' }), {
        event: 'sample-event',
      }),
    )

    expect(emitted.userId).toBe('user-123')
    expect(emitted.requestId).toBe('req-123')
    expect(emitted.event).toBe('sample-event')
  })

  it('merges nested log contexts and lets inner keys override parent keys', () => {
    const emitted = withLogContext({ requestId: 'outer-request', userId: 'outer-user' }, () =>
      withLogContext({ requestId: 'inner-request', tenantId: 'tenant-1' }, () =>
        writeOnce(createLoggerOptions({ NODE_ENV: 'production' }), {
          event: 'nested-event',
        }),
      ),
    )

    expect(emitted).toMatchObject({
      event: 'nested-event',
      requestId: 'inner-request',
      tenantId: 'tenant-1',
      userId: 'outer-user',
    })
    expect(getLogContext()).toEqual({})
  })

  it('resolves a Better Auth session once and includes userId plus extra context inside withUserId', async () => {
    const headers = requestHeaders({ cookie: 'better-auth.session_token=test' })
    mocks.headers.mockResolvedValue(headers)
    mocks.getSession.mockResolvedValue({
      user: {
        id: 'auth-user-123',
      },
    })

    const emitted = await withUserId(
      async () =>
        writeOnce(createLoggerOptions({ NODE_ENV: 'production' }), {
          event: 'session-event',
        }),
      { requestId: 'req-1' },
    )

    expect(mocks.getSession).toHaveBeenCalledTimes(1)
    expect(mocks.getSession).toHaveBeenCalledWith({ headers })
    expect(emitted).toMatchObject({
      event: 'session-event',
      requestId: 'req-1',
      userId: 'auth-user-123',
    })
    expect(getLogContext()).toEqual({})
  })

  it('runs with only extra context when no session is available', async () => {
    mocks.getSession.mockResolvedValue(null)

    const emitted = await withUserId(
      () =>
        writeOnce(createLoggerOptions({ NODE_ENV: 'production' }), {
          event: 'anonymous-event',
        }),
      { requestId: 'anon-req' },
    )

    expect(mocks.getSession).toHaveBeenCalledTimes(1)
    expect(emitted.userId).toBeUndefined()
    expect(emitted).toMatchObject({
      event: 'anonymous-event',
      requestId: 'anon-req',
    })
  })

  it('runs with only extra context when session lookup throws', async () => {
    mocks.getSession.mockRejectedValue(new Error('auth unavailable'))

    const emitted = await withUserId(
      () =>
        writeOnce(createLoggerOptions({ NODE_ENV: 'production' }), {
          event: 'auth-failure-event',
        }),
      { requestId: 'failure-req' },
    )

    expect(emitted.userId).toBeUndefined()
    expect(emitted).toMatchObject({
      event: 'auth-failure-event',
      requestId: 'failure-req',
    })
    expect(getLogContext()).toEqual({})
  })

  it('uses the staging header shortcut without calling Better Auth', async () => {
    vi.stubEnv('STAGING_KEY', 'staging-key')
    vi.stubEnv('STAGING_USER_ID', 'staging-user-42')
    mocks.headers.mockResolvedValue(requestHeaders({ 'x-staging-key': 'staging-key' }))

    const emitted = await withUserId(() =>
      writeOnce(createLoggerOptions({ NODE_ENV: 'production' }), {
        event: 'staging-event',
      }),
    )

    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(emitted).toMatchObject({
      event: 'staging-event',
      userId: 'staging-user-42',
    })
  })

  it('cleans up user context after the wrapper completes', async () => {
    mocks.getSession.mockResolvedValue({
      user: {
        id: 'scoped-user',
      },
    })

    await withUserId(() =>
      writeOnce(createLoggerOptions({ NODE_ENV: 'production' }), {
        event: 'scoped-event',
      }),
    )

    const emittedAfterWrapper = writeOnce(createLoggerOptions({ NODE_ENV: 'production' }), {
      event: 'after-wrapper-event',
    })

    expect(getLogContext()).toEqual({})
    expect(emittedAfterWrapper.userId).toBeUndefined()
  })

  it('exports a usable process-wide Pino logger', () => {
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.child).toBe('function')
  })
})
