import { timingSafeEqual } from 'node:crypto'

/**
 * Staging bypass: lets internal staging/preview environments skip auth by
 * sending the `x-staging-key` header. Shared by proxy.ts, lib/dal/auth.ts, and
 * lib/logger.ts so the security-critical comparison lives in one place.
 *
 * INERT IN PRODUCTION: on Vercel, `VERCEL_ENV === 'production'` for the
 * production deployment, so the bypass can never fire there — even if
 * STAGING_KEY is accidentally scoped to Production. Outside production the
 * behaviour is unchanged (active whenever STAGING_KEY is set). The app deploys
 * on Vercel; earlier revisions targeted Railway.
 *
 * The comparison is constant-time (crypto.timingSafeEqual) because the key is a
 * bearer credential — a plain `===` short-circuits on the first differing byte
 * and is timing-attackable in principle.
 */
export function isStagingBypass(headerValue: string | null | undefined): boolean {
  if (process.env.VERCEL_ENV === 'production') {
    return false
  }

  const expected = process.env.STAGING_KEY
  if (!expected) {
    return false
  }

  if (typeof headerValue !== 'string' || headerValue.length === 0) {
    return false
  }

  const provided = Buffer.from(headerValue)
  const secret = Buffer.from(expected)

  // timingSafeEqual throws on length mismatch; guard first (length is not secret).
  if (provided.length !== secret.length) {
    return false
  }

  return timingSafeEqual(provided, secret)
}

/** User id impersonated by the staging bypass. */
export function stagingUserId(): string {
  return process.env.STAGING_USER_ID ?? 'staging-user'
}
