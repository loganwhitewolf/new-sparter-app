import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({
  probeDb: vi.fn(),
  probeR2: vi.fn(),
  loggerInfo: vi.fn(),
}))

vi.mock('@/lib/services/health', () => ({
  DEFAULT_DB_TIMEOUT_MS: 2500,
  probeDb: mocks.probeDb,
  probeR2: mocks.probeR2,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mocks.loggerInfo,
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

const { GET } = await import('../app/api/health/route')

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  mocks.probeDb.mockResolvedValue({ ok: true, latencyMs: 5 })
  mocks.probeR2.mockReturnValue({ ok: true })
})

async function callGet() {
  const response = await GET()
  const body = await response.json()
  return { response, body }
}

describe('GET /api/health — happy path', () => {
  it('returns HTTP 200 with status ok when DB resolves and all R2 vars present', async () => {
    const { response, body } = await callGet()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.components.db.ok).toBe(true)
    expect(body.components.r2.ok).toBe(true)
    expect(body.timestamp).toBeDefined()
  })

  it('emits health_check_completed log event with correct fields', async () => {
    await callGet()

    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'health_check_completed',
        status: 'ok',
        dbOk: true,
        r2Ok: true,
      }),
    )
  })

  it('does not include DATABASE_URL or R2 secret values in the response body', async () => {
    const { body } = await callGet()
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('postgres://')
    expect(serialized).not.toContain('secret-access-key')
  })
})

describe('GET /api/health — missing R2 vars', () => {
  it('returns degraded with missing var names when R2 env is incomplete', async () => {
    mocks.probeR2.mockReturnValue({ ok: false, missing: ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'] })

    const { response, body } = await callGet()

    expect(response.status).toBe(200)
    expect(body.status).toBe('degraded')
    expect(body.components.r2.ok).toBe(false)
    expect(body.components.r2.missing).toEqual(
      expect.arrayContaining(['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']),
    )
  })

  it('does not include R2 secret values in the degraded response', async () => {
    mocks.probeR2.mockReturnValue({ ok: false, missing: ['R2_ACCESS_KEY_ID'] })

    const { body } = await callGet()
    const serialized = JSON.stringify(body)
    // response includes only variable names, never values
    expect(serialized).not.toContain('supersecretaccesskey')
    expect(serialized).not.toContain('supersecretkey')
  })

  it('does not log R2 secret values in degraded state', async () => {
    mocks.probeR2.mockReturnValue({ ok: false, missing: ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'] })

    await callGet()

    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'health_check_completed',
        r2Ok: false,
        r2Missing: expect.arrayContaining(['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']),
      }),
    )
    // the logged r2Missing must contain only names, not values
    const loggedArgs = mocks.loggerInfo.mock.calls[0][0] as Record<string, unknown>
    expect(loggedArgs.r2Missing).not.toContain('supersecretkey')
  })
})

describe('GET /api/health — DATABASE_URL missing', () => {
  it('returns degraded without executing a DB query when DATABASE_URL is absent', async () => {
    mocks.probeDb.mockResolvedValue({ ok: false, code: 'database_configuration_missing', latencyMs: 0 })

    const { response, body } = await callGet()

    expect(response.status).toBe(200)
    expect(body.status).toBe('degraded')
    expect(body.components.db.ok).toBe(false)
    expect(body.components.db.code).toBe('database_configuration_missing')
  })

  it('does not include DATABASE_URL value in the response body', async () => {
    mocks.probeDb.mockResolvedValue({ ok: false, code: 'database_configuration_missing', latencyMs: 0 })

    const { body } = await callGet()
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('postgres://')
  })
})

describe('GET /api/health — DB rejection', () => {
  it('returns HTTP 200 degraded with database_unreachable when DB rejects', async () => {
    mocks.probeDb.mockResolvedValue({ ok: false, code: 'database_unreachable', latencyMs: 12 })

    const { response, body } = await callGet()

    expect(response.status).toBe(200)
    expect(body.status).toBe('degraded')
    expect(body.components.db.ok).toBe(false)
    expect(body.components.db.code).toBe('database_unreachable')
  })

  it('does not include the raw DB error message in the response body', async () => {
    mocks.probeDb.mockResolvedValue({ ok: false, code: 'database_unreachable', latencyMs: 5 })

    const { body } = await callGet()
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('connection refused')
  })
})

describe('GET /api/health — DB timeout', () => {
  it('returns degraded with database_timeout code when DB hangs', async () => {
    mocks.probeDb.mockResolvedValue({ ok: false, code: 'database_timeout', latencyMs: 2500 })

    const { response, body } = await callGet()

    expect(response.status).toBe(200)
    expect(body.status).toBe('degraded')
    expect(body.components.db.ok).toBe(false)
    expect(body.components.db.code).toBe('database_timeout')
  })
})

describe('GET /api/health — response shape', () => {
  it('always includes timestamp in ISO 8601 format', async () => {
    const { body } = await callGet()
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp)
  })

  it('includes latencyMs on db component when DB is reachable', async () => {
    const { body } = await callGet()
    expect(typeof body.components.db.latencyMs).toBe('number')
    expect(body.components.db.latencyMs).toBeGreaterThanOrEqual(0)
  })
})
