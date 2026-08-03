import { verifySession } from '@/lib/dal/auth'
import { getAmortizationPlanList } from '@/lib/dal/amortization'
import { db } from '@/lib/db'
import { healOrphanedOpenPlanReduceDriftsForUser } from '@/lib/services/amortization-plan-amount'
import { EmptyState } from '@/components/data-table/EmptyState'
import { AmortizationTable } from '@/components/amortizations/amortization-table'
import { AmortizationSummaryHeader } from '@/components/amortizations/amortization-summary-header'
import { APP_ROUTES } from '@/lib/routes'

export const metadata = { title: 'Spese dilazionate' }

/**
 * RSC list page (Phase 79): DB -> DAL -> real page. Zero-plan accounts render the account-level
 * EmptyState('no-data') here; a non-empty fetch mounts the AmortizationSummaryHeader (D-B1) plus
 * the full interactive AmortizationTable (search/status filter/sort), which owns its own
 * filtered-to-zero EmptyState('no-result') internally. The summary header never renders in the
 * EmptyState branch — an account with plans that are ALL closed still mounts it (shows '€0,00'),
 * since "no plans at all" and "no OPEN plans" are two distinct states.
 */
export default async function AmortizationsPage() {
  const { userId } = await verifySession()
  await healOrphanedOpenPlanReduceDriftsForUser(db, userId)
  const plans = await getAmortizationPlanList(userId)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Spese dilazionate</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tutte le rate delle tue spese dilazionate.
        </p>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          variant="no-data"
          message="Nessuna spesa dilazionata"
          hint="Non hai ancora nessuna spesa dilazionata attiva. Quando dilazionerai una spesa, vedrai qui tutte le tue rate."
        />
      ) : (
        <>
          <AmortizationSummaryHeader plans={plans} />
          <AmortizationTable plans={plans} route={APP_ROUTES.amortizations} />
        </>
      )}
    </div>
  )
}
