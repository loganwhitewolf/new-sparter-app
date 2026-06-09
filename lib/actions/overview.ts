'use server'
import { verifySession } from '@/lib/dal/auth'
import { getMonthOverMonthCategoryChanges, type MonthOverMonthChange } from '@/lib/dal/overview'

/**
 * Fetches month-over-month category changes for the movers panel.
 *
 * Trust boundary: verifySession() is called first before any DAL access.
 * The DAL independently scopes every query by userId (defense in depth, T-45-02).
 *
 * Input validation (T-45-01): year and monthIndex are user-controlled integers
 * arriving from client state on bar click. We bound them before hitting the DAL.
 */
export async function fetchMovers(
  year: number,
  monthIndex: number,
): Promise<{ movers: MonthOverMonthChange[]; error: string | null }> {
  try {
    // Trust boundary: verify session first — DAL handles userId internally, void to satisfy unused binding
    const { userId } = await verifySession()
    void userId

    // Input validation — T-45-01: bound the two user-controlled integers before hitting the DAL
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

    const movers = await getMonthOverMonthCategoryChanges(year, monthIndex)
    return { movers, error: null }
  } catch {
    return {
      movers: [],
      error: 'Non è stato possibile caricare i dati. Riprova.',
    }
  }
}
