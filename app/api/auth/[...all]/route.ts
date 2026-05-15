import { auth } from '@/auth'
import { REGISTRATION_DISABLED_MESSAGE, isRegistrationEnabled } from '@/lib/auth/registration'
import { toNextJsHandler } from 'better-auth/next-js'

const authHandlers = toNextJsHandler(auth)

function isEmailSignUpRequest(request: Request): boolean {
  return new URL(request.url).pathname.replace(/\/$/, '') === '/api/auth/sign-up/email'
}

export const GET = authHandlers.GET

export function POST(request: Request) {
  if (!isRegistrationEnabled() && isEmailSignUpRequest(request)) {
    return Response.json(
      {
        error: {
          code: 'registration_disabled',
          message: REGISTRATION_DISABLED_MESSAGE,
        },
      },
      { status: 403 },
    )
  }

  return authHandlers.POST(request)
}
