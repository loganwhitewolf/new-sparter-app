import pino from 'pino'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const {
  DEFAULT_BETTERSTACK_ENDPOINT,
  buildTransportConfig,
  createLoggerOptions,
  logger,
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

  it('adds request-scoped userId from AsyncLocalStorage to emitted records', () => {
    const emitted = withUserId('user-123', () => writeOnce(createLoggerOptions({ NODE_ENV: 'production' }), {
      event: 'sample-event',
    }))

    expect(emitted.userId).toBe('user-123')
    expect(emitted.event).toBe('sample-event')
  })

  it('exports a usable process-wide Pino logger', () => {
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.child).toBe('function')
  })
})
