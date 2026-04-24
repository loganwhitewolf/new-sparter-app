// Phase 1 placeholder.
// Next.js 16 uses proxy.ts instead of middleware.ts.
import { type NextRequest, NextResponse } from 'next/server'

export function proxy(_request: NextRequest) {
  // Phase 1: allow all requests through.
  // Phase 2: add Better Auth JWT checks and staging bypass header support.
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
