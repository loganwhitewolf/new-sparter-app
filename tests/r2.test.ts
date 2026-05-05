import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({
  getSignedUrl: vi.fn(),
  send: vi.fn(),
  loggerError: vi.fn(),
}))

vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: class GetObjectCommand {
    constructor(readonly input: unknown) {}
  },
  HeadObjectCommand: class HeadObjectCommand {
    constructor(readonly input: unknown) {}
  },
  PutObjectCommand: class PutObjectCommand {
    constructor(readonly input: unknown) {}
  },
  S3Client: class S3Client {
    send = mocks.send
  },
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mocks.getSignedUrl,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: mocks.loggerError,
  },
}))

const { R2ServiceError, REQUIRED_R2_ENV_VARS, getMissingR2EnvVars, createPresignedPutUrl, headObject, readObjectBody } = await import('../lib/services/r2')

function setR2Env(overrides: Record<string, string | undefined> = {}) {
  vi.stubEnv('R2_ACCOUNT_ID', overrides.R2_ACCOUNT_ID ?? 'account-id')
  vi.stubEnv('R2_ACCESS_KEY_ID', overrides.R2_ACCESS_KEY_ID ?? 'access-key-id')
  vi.stubEnv('R2_SECRET_ACCESS_KEY', overrides.R2_SECRET_ACCESS_KEY ?? 'secret-access-key')
  vi.stubEnv('R2_BUCKET_NAME', overrides.R2_BUCKET_NAME ?? 'bucket-name')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  setR2Env()
  mocks.getSignedUrl.mockResolvedValue('https://r2.example.test/object.csv?signature=secret')
  mocks.send.mockResolvedValue({
    ContentLength: 128,
    ContentType: 'text/csv',
    ETag: '"etag-1"',
    LastModified: new Date('2026-01-01T00:00:00.000Z'),
  })
})

describe('R2 env helpers', () => {
  it('REQUIRED_R2_ENV_VARS contains the four required variable names', () => {
    expect(REQUIRED_R2_ENV_VARS).toEqual(
      expect.arrayContaining(['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']),
    )
    expect(REQUIRED_R2_ENV_VARS).toHaveLength(4)
  })

  it('getMissingR2EnvVars returns empty array when all vars are set', () => {
    const env = {
      NODE_ENV: 'test' as const,
      R2_ACCOUNT_ID: 'account-id',
      R2_ACCESS_KEY_ID: 'access-key-id',
      R2_SECRET_ACCESS_KEY: 'secret-access-key',
      R2_BUCKET_NAME: 'bucket-name',
    }
    expect(getMissingR2EnvVars(env)).toEqual([])
  })

  it('getMissingR2EnvVars returns missing var names for absent entries', () => {
    const env = {
      NODE_ENV: 'test' as const,
      R2_ACCOUNT_ID: 'account-id',
      R2_BUCKET_NAME: 'bucket-name',
    }
    const missing = getMissingR2EnvVars(env)
    expect(missing).toEqual(expect.arrayContaining(['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']))
    expect(missing).toHaveLength(2)
  })

  it('getMissingR2EnvVars treats blank/whitespace values as missing', () => {
    const env = {
      NODE_ENV: 'test' as const,
      R2_ACCOUNT_ID: '  ',
      R2_ACCESS_KEY_ID: '',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET_NAME: 'bucket',
    }
    const missing = getMissingR2EnvVars(env)
    expect(missing).toEqual(expect.arrayContaining(['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID']))
    expect(missing).toHaveLength(2)
  })

  it('getMissingR2EnvVars never returns values, only variable names', () => {
    const env = { NODE_ENV: 'test' as const, R2_ACCOUNT_ID: 'super-secret-value' }
    const missing = getMissingR2EnvVars(env)
    const serialized = JSON.stringify(missing)
    expect(serialized).not.toContain('super-secret-value')
  })
})

describe('R2 service diagnostics', () => {
  it('logs missing configuration names without secret values before failing presign', async () => {
    vi.stubEnv('R2_ACCESS_KEY_ID', '')
    vi.stubEnv('R2_SECRET_ACCESS_KEY', '')

    await expect(createPresignedPutUrl({
      objectKey: 'users/user-1/imports/file.csv',
      contentType: 'text/csv',
      contentLength: 128,
    })).rejects.toMatchObject({
      code: 'r2_configuration_missing',
      status: 503,
    })

    expect(mocks.loggerError).toHaveBeenCalledWith(expect.objectContaining({
      event: 'r2_operation_failed',
      operation: 'presign_put',
      objectKey: 'users/user-1/imports/file.csv',
      code: 'r2_configuration_missing',
      status: 503,
      missingEnvVars: ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'],
    }))
    expect(JSON.stringify(mocks.loggerError.mock.calls)).not.toContain('secret-access-key')
  })

  it('logs normalized HEAD 404 metadata and throws an R2ServiceError', async () => {
    mocks.send.mockRejectedValueOnce(Object.assign(new Error('not found'), {
      name: 'NoSuchKey',
      $metadata: { httpStatusCode: 404, requestId: 'raw-request-id' },
    }))

    await expect(headObject('users/user-1/imports/missing.csv')).rejects.toMatchObject({
      code: 'r2_object_not_found',
      status: 404,
      message: 'Uploaded object was not found. Please upload again.',
    })

    expect(mocks.loggerError).toHaveBeenCalledWith(expect.objectContaining({
      event: 'r2_operation_failed',
      operation: 'head_object',
      objectKey: 'users/user-1/imports/missing.csv',
      code: 'r2_object_not_found',
      status: 404,
      error: expect.objectContaining({
        name: 'NoSuchKey',
        message: 'not found',
      }),
    }))
    expect(JSON.stringify(mocks.loggerError.mock.calls)).not.toContain('raw-request-id')
  })

  it('logs normalized read timeouts without raw SDK objects', async () => {
    mocks.send.mockRejectedValueOnce(Object.assign(new Error('deadline exceeded'), { name: 'TimeoutError' }))

    await expect(readObjectBody('users/user-1/imports/file.csv')).rejects.toMatchObject({
      code: 'r2_timeout',
      status: 504,
    })

    expect(mocks.loggerError).toHaveBeenCalledWith(expect.objectContaining({
      event: 'r2_operation_failed',
      operation: 'read_object',
      objectKey: 'users/user-1/imports/file.csv',
      code: 'r2_timeout',
      status: 504,
    }))
  })

  it('preserves explicit R2ServiceError metadata when logging presign failures', async () => {
    mocks.getSignedUrl.mockRejectedValueOnce(new R2ServiceError('r2_presign_failed', 'Could not prepare upload storage. Please retry.', 502))

    await expect(createPresignedPutUrl({
      objectKey: 'users/user-1/imports/file.csv',
      contentType: 'text/csv',
      contentLength: 128,
    })).rejects.toMatchObject({
      code: 'r2_presign_failed',
      status: 502,
    })

    expect(mocks.loggerError).toHaveBeenCalledWith(expect.objectContaining({
      event: 'r2_operation_failed',
      operation: 'presign_put',
      objectKey: 'users/user-1/imports/file.csv',
      code: 'r2_presign_failed',
      status: 502,
    }))
  })
})
