import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getMissingR2EnvVars } from '@/lib/services/r2'

export const DEFAULT_DB_TIMEOUT_MS = 2500

export type DbComponent =
  | { ok: true; latencyMs: number }
  | { ok: false; code: string; latencyMs: number }

export type R2Component =
  | { ok: true }
  | { ok: false; missing: string[] }

export type HealthResponse = {
  status: 'ok' | 'degraded'
  timestamp: string
  components: {
    db: DbComponent
    r2: R2Component
  }
}

export async function probeDb(timeoutMs: number = DEFAULT_DB_TIMEOUT_MS): Promise<DbComponent> {
  if (!process.env.DATABASE_URL) {
    return { ok: false, code: 'database_configuration_missing', latencyMs: 0 }
  }

  const start = Date.now()

  try {
    const probePromise = db.execute(sql`SELECT 1`)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs),
    )

    await Promise.race([probePromise, timeoutPromise])
    return { ok: true, latencyMs: Date.now() - start }
  } catch (error: unknown) {
    const latencyMs = Date.now() - start
    const message = error instanceof Error ? error.message : ''
    if (message === 'timeout') {
      return { ok: false, code: 'database_timeout', latencyMs }
    }
    return { ok: false, code: 'database_unreachable', latencyMs }
  }
}

export function probeR2(): R2Component {
  const missing = getMissingR2EnvVars()
  if (missing.length > 0) {
    return { ok: false, missing }
  }
  return { ok: true }
}
