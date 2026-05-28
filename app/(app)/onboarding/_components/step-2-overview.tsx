import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { getLatestImportSummaryForUser } from '@/lib/dal/imports'
import { formatMonthRange } from '@/lib/utils/date'
import { APP_ROUTES } from '@/lib/routes'
import { buildStep2ViewModel } from '@/app/(app)/onboarding/_components/step-2-view-model'

type Step2OverviewProps = {
  userId: string
}

/**
 * Step 2 — overview of the just-imported file with real aggregates (R-OB-05, R-OB-10).
 * Data comes from the user's latest imported file via getLatestImportSummaryForUser.
 * All monetary amounts are passed through Intl.NumberFormat('it-IT') — no native arithmetic.
 */
export async function Step2Overview({ userId }: Step2OverviewProps) {
  const summary = await getLatestImportSummaryForUser(userId)

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 text-center">
        <p className="text-muted-foreground mb-6">Nessun file caricato</p>
        <Link
          href={`${APP_ROUTES.onboarding}?step=1`}
          className="text-sm font-medium underline text-foreground/70 hover:text-foreground"
        >
          Torna al caricamento
        </Link>
      </div>
    )
  }

  const vm = buildStep2ViewModel(summary)

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] px-6 pt-4 pb-24 text-foreground">
      {/* File name row */}
      <div className="flex items-center gap-2 mb-10">
        <CheckCircle className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
        <span className="text-sm text-foreground/50 truncate">{summary.fileName}</span>
      </div>

      {/* Large transaction count */}
      <p className="text-foreground/50 text-sm uppercase tracking-widest mb-2">Il tuo estratto</p>
      <div className="text-7xl font-black mb-1">{summary.importedCount}</div>
      <p className="text-foreground/60 text-lg mb-10">transazioni importate</p>

      {/* Income + expenses stat cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="rounded-2xl bg-foreground/10 p-5">
          <div className="text-2xl font-bold text-success">+€{vm.formattedPositiveTotal}</div>
          <div className="text-xs text-foreground/50 mt-1">entrate</div>
        </div>
        <div className="rounded-2xl bg-foreground/10 p-5">
          <div className="text-2xl font-bold text-destructive">−€{vm.formattedNegativeTotal}</div>
          <div className="text-xs text-foreground/50 mt-1">uscite</div>
        </div>
      </div>

      {/* Auto-categorized progress bar */}
      <div className="rounded-2xl bg-foreground/10 p-5 mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-foreground/70">
            {summary.autoCategorizedCount} di {summary.importedCount} già categorizzate
          </span>
          <span className="font-semibold">{vm.pct}%</span>
        </div>
        <div className="h-2 bg-foreground/10 rounded-full overflow-hidden">
          <div
            className="h-2 bg-success rounded-full"
            style={{ width: `${vm.pct}%` }}
            role="progressbar"
            aria-valuenow={vm.pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Month range label */}
      <p className="text-xs text-foreground/30 mb-10">{vm.monthsLabel}</p>
    </div>
  )
}
