import 'server-only'
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { logger } from '@/lib/logger'

const DEFAULT_UPLOAD_TTL_SECONDS = 10 * 60
const DEFAULT_R2_TIMEOUT_MS = 10_000

export type R2ObjectHead = {
  contentLength: number | null
  contentType: string | null
  eTag: string | null
  lastModified: Date | null
}

export class R2ServiceError extends Error {
  readonly code: string
  readonly status: number
  readonly missingEnvVars?: string[]

  constructor(code: string, message: string, status = 502, details: { missingEnvVars?: string[] } = {}) {
    super(message)
    this.name = 'R2ServiceError'
    this.code = code
    this.status = status
    this.missingEnvVars = details.missingEnvVars
  }
}

type R2Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  endpoint: string
}

type R2Operation = 'presign_put' | 'head_object' | 'read_object'

type SerializedR2Error = {
  name?: string
  message?: string
  code?: string
  status?: number
}

function env(name: string) {
  const value = process.env[name]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function getErrorName(error: unknown) {
  return typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : undefined
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : typeof error === 'string' ? error : undefined
}

function getMetadataStatus(error: unknown) {
  return typeof error === 'object' &&
    error !== null &&
    '$metadata' in error &&
    typeof error.$metadata === 'object' &&
    error.$metadata !== null &&
    'httpStatusCode' in error.$metadata &&
    typeof error.$metadata.httpStatusCode === 'number'
    ? error.$metadata.httpStatusCode
    : undefined
}

function getProviderCode(error: unknown) {
  if (error instanceof R2ServiceError) return error.code

  if (typeof error === 'object' && error !== null && 'Code' in error && typeof error.Code === 'string') {
    return error.Code
  }

  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code
  }

  return undefined
}

export function serializeR2Error(error: unknown): SerializedR2Error {
  return {
    name: getErrorName(error),
    message: getErrorMessage(error),
    code: getProviderCode(error),
    status: error instanceof R2ServiceError ? error.status : getMetadataStatus(error),
  }
}

function logR2OperationFailed(input: {
  operation: R2Operation
  objectKey: string
  code: string
  status: number
  error: unknown
  missingEnvVars?: string[]
}) {
  logger.error({
    event: 'r2_operation_failed',
    operation: input.operation,
    objectKey: input.objectKey,
    code: input.code,
    status: input.status,
    error: serializeR2Error(input.error),
    ...(input.missingEnvVars ? { missingEnvVars: input.missingEnvVars } : {}),
  })
}

export const REQUIRED_R2_ENV_VARS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'] as const

export function getMissingR2EnvVars(environment: NodeJS.ProcessEnv = process.env): string[] {
  return REQUIRED_R2_ENV_VARS.filter((name) => {
    const value = environment[name]
    return !(typeof value === 'string' && value.trim().length > 0)
  })
}

function getR2Config(operation: R2Operation, objectKey: string): R2Config {
  const accountId = env('R2_ACCOUNT_ID')
  const accessKeyId = env('R2_ACCESS_KEY_ID')
  const secretAccessKey = env('R2_SECRET_ACCESS_KEY')
  const bucketName = env('R2_BUCKET_NAME')
  const missingEnvVars = getMissingR2EnvVars()

  if (missingEnvVars.length > 0) {
    const error = new R2ServiceError(
      'r2_configuration_missing',
      'Upload storage is not configured. Please try again later.',
      503,
      { missingEnvVars },
    )

    logR2OperationFailed({
      operation,
      objectKey,
      code: error.code,
      status: error.status,
      error,
      missingEnvVars,
    })

    throw error
  }

  return {
    accountId: accountId!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucketName: bucketName!,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  }
}

let cachedClient: S3Client | null = null
let cachedEndpoint: string | null = null
let cachedBucketName: string | null = null

function getR2Client(operation: R2Operation, objectKey: string) {
  const config = getR2Config(operation, objectKey)
  if (cachedClient && cachedEndpoint === config.endpoint && cachedBucketName === config.bucketName) {
    return { client: cachedClient, bucketName: config.bucketName }
  }

  cachedClient = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
  cachedEndpoint = config.endpoint
  cachedBucketName = config.bucketName

  return { client: cachedClient, bucketName: config.bucketName }
}

function ttlSeconds() {
  const configured = Number(process.env.R2_PRESIGNED_UPLOAD_TTL_SECONDS)
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_UPLOAD_TTL_SECONDS
  return Math.min(Math.floor(configured), 60 * 60)
}

function timeoutSignal(timeoutMs = DEFAULT_R2_TIMEOUT_MS) {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return AbortSignal.timeout(timeoutMs)
  }
  return undefined
}

function toR2ServiceError(error: unknown, fallbackCode: string, fallbackMessage: string) {
  if (error instanceof R2ServiceError) return error

  const name = getErrorName(error) ?? ''
  const statusCode = getMetadataStatus(error)

  if (name === 'AbortError' || name === 'TimeoutError') {
    return new R2ServiceError('r2_timeout', 'Upload storage timed out. Please retry.', 504)
  }
  if (statusCode === 404) {
    return new R2ServiceError('r2_object_not_found', 'Uploaded object was not found. Please upload again.', 404)
  }

  return new R2ServiceError(fallbackCode, fallbackMessage, statusCode && statusCode >= 400 ? 502 : 502)
}

function normalizeR2Error(
  error: unknown,
  operation: R2Operation,
  objectKey: string,
  fallbackCode: string,
  fallbackMessage: string,
): never {
  const serviceError = toR2ServiceError(error, fallbackCode, fallbackMessage)

  if (serviceError.code !== 'r2_configuration_missing') {
    logR2OperationFailed({
      operation,
      objectKey,
      code: serviceError.code,
      status: serviceError.status,
      error,
      missingEnvVars: serviceError.missingEnvVars,
    })
  }

  throw serviceError
}

export async function createPresignedPutUrl(input: {
  objectKey: string
  contentType: string
  contentLength: number
}) {
  try {
    const { client, bucketName } = getR2Client('presign_put', input.objectKey)
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: input.objectKey,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    })
    const expiresIn = ttlSeconds()
    const url = await getSignedUrl(client, command, { expiresIn })

    return { url, expiresIn }
  } catch (error) {
    normalizeR2Error(error, 'presign_put', input.objectKey, 'r2_presign_failed', 'Could not prepare upload storage. Please retry.')
  }
}

export async function headObject(objectKey: string): Promise<R2ObjectHead> {
  try {
    const { client, bucketName } = getR2Client('head_object', objectKey)
    const response = await client.send(
      new HeadObjectCommand({ Bucket: bucketName, Key: objectKey }),
      { abortSignal: timeoutSignal() },
    )

    return {
      contentLength: response.ContentLength ?? null,
      contentType: response.ContentType ?? null,
      eTag: response.ETag?.replace(/^\"|\"$/g, '') ?? null,
      lastModified: response.LastModified ?? null,
    }
  } catch (error) {
    normalizeR2Error(error, 'head_object', objectKey, 'r2_head_failed', 'Could not verify uploaded file. Please retry.')
  }
}

export async function readObjectBody(objectKey: string) {
  try {
    const { client, bucketName } = getR2Client('read_object', objectKey)
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: objectKey }),
      { abortSignal: timeoutSignal() },
    )
    return response.Body
  } catch (error) {
    normalizeR2Error(error, 'read_object', objectKey, 'r2_read_failed', 'Could not read uploaded file. Please retry.')
  }
}
