import { auth } from '@/auth'

type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>

type AuthApiErrorLike = {
  name?: unknown
  status?: unknown
  statusCode?: unknown
  body?: {
    code?: unknown
    message?: unknown
  }
  message?: unknown
}

const recoverableAuthSessionErrorCodes = new Set([
  'FAILED_TO_GET_SESSION',
  'INVALID_TOKEN',
  'TOKEN_EXPIRED',
  'SESSION_EXPIRED',
])

export function isRecoverableAuthSessionError(error: unknown) {
  const authError = error as AuthApiErrorLike
  const isApiError = authError.name === 'APIError'
  const statusCode = authError.statusCode
  const isAuthFailure =
    authError.status === 'UNAUTHORIZED' ||
    authError.status === 401 ||
    statusCode === 401 ||
    // Treat FAILED_TO_GET_SESSION on 500 as recoverable: the DB may be
    // transiently unavailable at startup; redirect to login rather than crash.
    (statusCode === 500 && authError.status === 'INTERNAL_SERVER_ERROR')
  const errorCode = typeof authError.body?.code === 'string' ? authError.body.code : undefined
  const errorMessage =
    typeof authError.body?.message === 'string'
      ? authError.body.message
      : typeof authError.message === 'string'
        ? authError.message
        : undefined

  return (
    isApiError &&
    isAuthFailure &&
    (recoverableAuthSessionErrorCodes.has(errorCode ?? '') || errorMessage === 'Failed to get session')
  )
}

export async function getAuthSessionOrNull(headers: Headers): Promise<AuthSession | null> {
  try {
    return await auth.api.getSession({ headers })
  } catch (error) {
    if (isRecoverableAuthSessionError(error)) {
      return null
    }

    throw error
  }
}
