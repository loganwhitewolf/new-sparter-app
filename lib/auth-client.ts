import { createAuthClient } from 'better-auth/react'

// baseURL is intentionally omitted: the auth server (/api/auth/*) is served by
// this same Next.js app, so Better Auth defaults to the current origin. The base
// URL lives in a single place, server-side, as BETTER_AUTH_URL.
export const authClient = createAuthClient()
