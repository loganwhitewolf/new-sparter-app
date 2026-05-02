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
