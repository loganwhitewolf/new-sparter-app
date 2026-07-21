'use server'
import { verifySession } from '@/lib/dal/auth'
import { getMonthOverMonthCategoryChanges, type MonthOverMonthChange } from '@/lib/dal/overview'

/**
 * Fetches month-over-month changes for the movers panel.
 *
 * Trust boundary: verifySession() is called first before any DAL access.
 * The DAL independently scopes every query by userId (defense in depth, T-45-02).
 *
 * Input validation (T-45-01, T-49-02-01): year, monthIndex, and direction are user-controlled
 * values arriving from client state on bar click. We bound them before hitting the DAL.
 *
 * T-49-02-01 mitigated: direction validated against closed enum before DAL call (Tampering).
 */

const VALID_DIRECTIONS = ['in', 'out', 'allocation'] as const
type ValidDirection = typeof VALID_DIRECTIONS[number]

export async function fetchMovers(
  year: number,
  monthIndex: number,
  direction: 'in' | 'out' | 'allocation' = 'out',
  tagId?: number,
): Promise<{ movers: MonthOverMonthChange[]; error: string | null }> {
  try {
    // Trust boundary: verify session first — DAL handles userId internally, void to satisfy unused binding
    const { userId } = await verifySession()
    void userId

    // Input validation — T-45-01 / T-49-02-01: bound the three user-controlled inputs before hitting the DAL
    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100 ||
      !Number.isInteger(monthIndex) ||
      monthIndex < 0 ||
      monthIndex > 11
    ) {
      return { movers: [], error: 'Parametri non validi.' }
    }

    // Closed-enum validation for direction (T-49-02-01 Tampering mitigation)
    if (!(VALID_DIRECTIONS as readonly string[]).includes(direction)) {
      return { movers: [], error: 'Parametri non validi.' }
    }

    // 68-03 (Pitfall 4): defensive bound on tagId, matching this file's existing
    // year/monthIndex idiom — a non-integer or non-positive value is dropped
    // (undefined), never trusted through as-is.
    const safeTagId = Number.isInteger(tagId) && (tagId as number) > 0 ? tagId : undefined

    const movers = await getMonthOverMonthCategoryChanges(
      year,
      monthIndex,
      direction as ValidDirection,
      10,
      safeTagId
    )
    return { movers, error: null }
  } catch {
    return {
      movers: [],
      error: 'Non è stato possibile caricare i dati. Riprova.',
    }
  }
}
