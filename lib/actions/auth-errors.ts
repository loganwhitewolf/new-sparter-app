import { logger } from '@/lib/logger'

const GENERIC_SIGN_UP_ERROR = 'Si è verificato un errore. Riprova.'

const DB_UNAVAILABLE_PATTERNS = [
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'connection refused',
  'connect ECONNREFUSED',
  'database_url',
]

const DB_MIGRATION_PATTERNS = [
  'relation "user" does not exist',
  'relation "session" does not exist',
  'column "subscriptionPlan" does not exist',
  'column "first_name" does not exist',
  'column "last_name" does not exist',
  'column "job_title" does not exist',
  'column "location" does not exist',
  'column "phone" does not exist',
  'column "timezone" does not exist',
]

function collectErrorText(error: unknown): string {
  if (error instanceof AggregateError) {
    return [String(error.message), ...error.errors.map(collectErrorText)].join(' ')
  }

  if (error instanceof Error) {
    const cause = 'cause' in error ? collectErrorText(error.cause) : ''
    return [error.name, error.message, cause].filter(Boolean).join(' ')
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>
    return [record.code, record.message, record.detail, record.cause]
      .map((value) => (typeof value === 'string' ? value : collectErrorText(value)))
      .filter(Boolean)
      .join(' ')
  }

  return typeof error === 'string' ? error : ''
}

function matchesAny(text: string, patterns: string[]): boolean {
  const normalized = text.toLowerCase()
  return patterns.some((pattern) => normalized.includes(pattern.toLowerCase()))
}

function readAuthApiFields(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return {}
  }

  const record = error as Record<string, unknown>
  const body = typeof record.body === 'object' && record.body !== null ? (record.body as Record<string, unknown>) : null

  return {
    status: typeof record.status === 'string' || typeof record.status === 'number' ? record.status : undefined,
    statusCode: typeof record.statusCode === 'number' ? record.statusCode : undefined,
    apiCode: typeof body?.code === 'string' ? body.code : undefined,
    apiMessage: typeof body?.message === 'string' ? body.message : undefined,
  }
}

/** Dev-only sanitized auth diagnostics (terminal / pino-pretty). Set AUTH_DEBUG=1 to enable elsewhere. */
export function logSanitizedAuthError(operation: string, error: unknown): void {
  if (process.env.NODE_ENV !== 'development' && process.env.AUTH_DEBUG !== '1') {
    return
  }

  const text = collectErrorText(error)
  const apiFields = readAuthApiFields(error)

  logger.warn({
    event: 'auth_debug_error',
    operation,
    errorName: error instanceof Error ? error.name : undefined,
    errorMessage: text.slice(0, 500),
    ...apiFields,
  })
}

export function getSafeSignUpErrorMessage(error: unknown): string {
  const text = collectErrorText(error)

  if (matchesAny(text, DB_UNAVAILABLE_PATTERNS)) {
    return 'Database non raggiungibile. Avvia Postgres con `npm run db:up`, poi esegui `npm run db:migrate` e riprova.'
  }

  if (matchesAny(text, DB_MIGRATION_PATTERNS)) {
    return 'Database non aggiornato. Esegui `npm run db:migrate` e riprova la registrazione.'
  }

  return GENERIC_SIGN_UP_ERROR
}
