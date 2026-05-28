import { describe, expect, it, vi } from 'vitest'

const {
  R2CorsError,
  buildR2CorsPolicy,
  safeStatusLine,
  setR2Cors,
  validateAllowedOrigin,
} = await import('../scripts/set-r2-cors.mjs')

function productionEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: 'production' as const,
    CLOUDFLARE_API_TOKEN: 'token-secret-value',
    R2_ACCOUNT_ID: 'account-secret-value',
    R2_BUCKET_NAME: 'bucket-secret-value',
    R2_CORS_ALLOWED_ORIGIN: 'https://app.example.test',
    ...overrides,
  }
}

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

describe('R2 CORS origin validation', () => {
  it('accepts a concrete deployed HTTPS origin for production', () => {
    expect(validateAllowedOrigin('https://app.example.test')).toBe('https://app.example.test')
  })

  it('rejects wildcard origins', () => {
    expect(() => validateAllowedOrigin('*')).toThrow(expect.objectContaining({ code: 'invalid_origin_wildcard' }))
  })

  it('rejects empty origins', () => {
    expect(() => validateAllowedOrigin('   ')).toThrow(expect.objectContaining({ code: 'invalid_origin_empty' }))
  })

  it('rejects unsupported protocols', () => {
    expect(() => validateAllowedOrigin('ftp://app.example.test')).toThrow(
      expect.objectContaining({ code: 'invalid_origin_protocol' }),
    )
  })

  it('rejects localhost unless explicit dev mode is enabled', () => {
    expect(() => validateAllowedOrigin('http://localhost:3000')).toThrow(
      expect.objectContaining({ code: 'invalid_origin_localhost_production' }),
    )
    expect(validateAllowedOrigin('http://localhost:3000', { devMode: true })).toBe('http://localhost:3000')
  })
})

describe('R2 CORS policy construction', () => {
  it('builds the minimal browser upload contract without wildcard production CORS', () => {
    const policy = buildR2CorsPolicy('https://app.example.test')

    expect(policy).toEqual({
      rules: [
        {
          allowed: {
            origins: ['https://app.example.test'],
            methods: ['PUT'],
            headers: ['Content-Type'],
          },
          exposeHeaders: [],
          maxAgeSeconds: 3000,
        },
      ],
    })
    expect(JSON.stringify(policy)).not.toContain('*')
    expect(JSON.stringify(policy)).not.toContain('Content-Length')
    expect(JSON.stringify(policy)).not.toContain('x-amz-sdk-checksum-algorithm')
  })
})

describe('R2 CORS helper Cloudflare calls', () => {
  it('fails validation before any network call when origin is malformed', async () => {
    const fetchImpl = vi.fn()
    const stderr = vi.fn()

    await expect(setR2Cors({
      env: productionEnv({ R2_CORS_ALLOWED_ORIGIN: '*' }),
      fetchImpl,
      stdout: vi.fn(),
      stderr,
    })).rejects.toMatchObject({ code: 'invalid_origin_wildcard' })

    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('sends only the minimal CORS policy and safe auth headers to Cloudflare', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: true }, { status: 200 }))
    const stdout = vi.fn()

    await expect(setR2Cors({ env: productionEnv(), fetchImpl, stdout, stderr: vi.fn() })).resolves.toMatchObject({
      status: 200,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, request] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/account-secret-value/r2/buckets/bucket-secret-value/cors')
    expect(request.method).toBe('PUT')
    expect(request.headers).toEqual({
      Authorization: 'Bearer token-secret-value',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(String(request.body))).toEqual(buildR2CorsPolicy('https://app.example.test'))
    expect(stdout).toHaveBeenCalledWith('{"event":"r2_cors_started","phase":"update_cors"}')
    expect(stdout).toHaveBeenCalledWith('{"event":"r2_cors_succeeded","phase":"update_cors","status":200}')
  })

  it('redacts provider error objects containing URL and token-like text', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      success: false,
      errors: [
        {
          message: 'failed for https://signed.example.test/object.csv?token=super-secret-token',
          token: 'super-secret-token',
          stack: 'raw stack trace',
        },
      ],
    }, { ok: true, status: 200 }))
    const stdout = vi.fn()
    const stderr = vi.fn()

    await expect(setR2Cors({ env: productionEnv(), fetchImpl, stdout, stderr })).rejects.toMatchObject({
      code: 'cf_api_error',
      status: 200,
    })

    const output = JSON.stringify([...stdout.mock.calls, ...stderr.mock.calls])
    expect(output).toContain('cf_api_error')
    expect(output).not.toContain('signed.example.test')
    expect(output).not.toContain('super-secret-token')
    expect(output).not.toContain('object.csv')
    expect(output).not.toContain('raw stack trace')
    expect(output).not.toContain('account-secret-value')
    expect(output).not.toContain('bucket-secret-value')
  })

  it('uses a safe code only for malformed provider JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new Error('raw response with token-secret-value')),
    })
    const stderr = vi.fn()

    await expect(setR2Cors({ env: productionEnv(), fetchImpl, stdout: vi.fn(), stderr })).rejects.toMatchObject({
      code: 'cf_malformed_response',
      status: 200,
    })

    const output = JSON.stringify(stderr.mock.calls)
    expect(output).toContain('cf_malformed_response')
    expect(output).not.toContain('token-secret-value')
    expect(output).not.toContain('raw response')
  })
})

describe('R2 CORS safe status lines', () => {
  it('omits unrecognized fields and unsafe code values', () => {
    expect(safeStatusLine('r2_cors_failed', {
      phase: 'update_cors',
      code: 'https://signed.example.test/?token=secret',
      status: 500,
      token: 'secret',
    })).toBe('{"event":"r2_cors_failed","phase":"update_cors","status":500}')
  })

  it('exposes stable safe codes for operator diagnostics', () => {
    expect(new R2CorsError('cf_http_error', 'safe').code).toBe('cf_http_error')
  })
})
