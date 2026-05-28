import { type NextRequest, NextResponse } from 'next/server'
import { getAuthSessionOrNull } from '@/lib/auth-session'

const PUBLIC_ROUTES = ['/login', '/register']
const AUTH_ROUTES = ['/login', '/register']

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  // D-07 / D-08: Staging bypass FIRST — before any auth check.
  // Active whenever STAGING_KEY env var is defined (not NODE_ENV-gated).
  // NEVER set STAGING_KEY in Railway production service.
  if (
    process.env.STAGING_KEY &&
    request.headers.get('x-staging-key') === process.env.STAGING_KEY
  ) {
    return NextResponse.next()
  }

  // Server Actions carry the `next-action` header. Redirecting them based on
  // session state breaks the action response format — the client expects RSC
  // content-type, not a 307 redirect. Let all Server Action requests pass
  // through unconditionally; the action itself handles auth or redirect.
  if (request.headers.has('next-action')) {
    return NextResponse.next()
  }

  // Session check via Better Auth Drizzle adapter (Node.js runtime)
  const session = await getAuthSessionOrNull(request.headers)

  const isAuthenticated = !!session?.user
  const isPublicRoute = PUBLIC_ROUTES.includes(path)
  const isAuthRoute = AUTH_ROUTES.includes(path)

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.nextUrl))
  }

  // Redirect unauthenticated users from protected pages
  if (!isPublicRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.nextUrl))
  }

  // Forward the pathname as a request header so RSC layouts can read it
  // without depending on edge-runtime-incompatible APIs. The layout reads
  // 'x-pathname' to implement the onboarding gate (D-11).
  // NOTE: this header is overwritten here on every request — a client-supplied
  // 'x-pathname' value is replaced before reaching the layout (T-38-01).
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
