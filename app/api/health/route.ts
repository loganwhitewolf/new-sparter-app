import 'server-only'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { DEFAULT_DB_TIMEOUT_MS, probeDb, probeR2 } from '@/lib/services/health'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const [dbResult, r2Result] = await Promise.all([probeDb(DEFAULT_DB_TIMEOUT_MS), Promise.resolve(probeR2())])

  const status: 'ok' | 'degraded' = dbResult.ok && r2Result.ok ? 'ok' : 'degraded'
  const timestamp = new Date().toISOString()

  logger.info({
    event: 'health_check_completed',
    status,
    dbOk: dbResult.ok,
    r2Ok: r2Result.ok,
    ...(dbResult.ok ? { dbLatencyMs: dbResult.latencyMs } : { dbCode: dbResult.code, dbLatencyMs: dbResult.latencyMs }),
    ...(!r2Result.ok ? { r2Missing: r2Result.missing } : {}),
    timestamp,
  })

  return NextResponse.json(
    {
      status,
      timestamp,
      components: {
        db: dbResult,
        r2: r2Result,
      },
    },
    { status: 200 },
  )
}
