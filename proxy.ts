import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

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

  // Session check via Better Auth Drizzle adapter (Node.js runtime)
  const session = await auth.api.getSession({
    headers: request.headers,
  })

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

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
