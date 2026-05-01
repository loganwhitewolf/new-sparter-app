import 'server-only'
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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

  constructor(code: string, message: string, status = 502) {
    super(message)
    this.name = 'R2ServiceError'
    this.code = code
    this.status = status
  }
}

type R2Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  endpoint: string
}

function env(name: string) {
  const value = process.env[name]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function getR2Config(): R2Config {
  const accountId = env('R2_ACCOUNT_ID')
  const accessKeyId = env('R2_ACCESS_KEY_ID')
  const secretAccessKey = env('R2_SECRET_ACCESS_KEY')
  const bucketName = env('R2_BUCKET_NAME')

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new R2ServiceError(
      'r2_configuration_missing',
      'Upload storage is not configured. Please try again later.',
      503,
    )
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  }
}

let cachedClient: S3Client | null = null
let cachedEndpoint: string | null = null

function getR2Client() {
  const config = getR2Config()
  if (cachedClient && cachedEndpoint === config.endpoint) {
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

function normalizeR2Error(error: unknown, fallbackCode: string, fallbackMessage: string): never {
  if (error instanceof R2ServiceError) throw error

  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : ''
  const statusCode =
    typeof error === 'object' &&
    error !== null &&
    '$metadata' in error &&
    typeof error.$metadata === 'object' &&
    error.$metadata !== null &&
    'httpStatusCode' in error.$metadata &&
    typeof error.$metadata.httpStatusCode === 'number'
      ? error.$metadata.httpStatusCode
      : undefined

  if (name === 'AbortError' || name === 'TimeoutError') {
    throw new R2ServiceError('r2_timeout', 'Upload storage timed out. Please retry.', 504)
  }
  if (statusCode === 404) {
    throw new R2ServiceError('r2_object_not_found', 'Uploaded object was not found. Please upload again.', 404)
  }

  throw new R2ServiceError(fallbackCode, fallbackMessage, statusCode && statusCode >= 400 ? 502 : 502)
}

export async function createPresignedPutUrl(input: {
  objectKey: string
  contentType: string
  contentLength: number
}) {
  try {
    const { client, bucketName } = getR2Client()
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
    normalizeR2Error(error, 'r2_presign_failed', 'Could not prepare upload storage. Please retry.')
  }
}

export async function headObject(objectKey: string): Promise<R2ObjectHead> {
  try {
    const { client, bucketName } = getR2Client()
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
    normalizeR2Error(error, 'r2_head_failed', 'Could not verify uploaded file. Please retry.')
  }
}

export async function readObjectBody(objectKey: string) {
  try {
    const { client, bucketName } = getR2Client()
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: objectKey }),
      { abortSignal: timeoutSignal() },
    )
    return response.Body
  } catch (error) {
    normalizeR2Error(error, 'r2_read_failed', 'Could not read uploaded file. Please retry.')
  }
}
