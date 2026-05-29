import Link from 'next/link'
import { getLatestImportSummaryForUser } from '@/lib/dal/imports'
import { APP_ROUTES } from '@/lib/routes'

type Step3EducationProps = {
  userId: string
}

/**
 * Step 3 — education panel showing uncategorized count and the giroconto tip (R-OB-06 / D-06).
 * Data is scoped to the user's latest imported file (T-38-08: no cross-user data).
 * The null branch is defensive; users normally reach step=3 only after a successful upload.
 */
export async function Step3Education({ userId }: Step3EducationProps) {
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

  const { uncategorizedCount, autoCategorizedCount } = summary

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 text-center">
      {/* Large uncategorized count numeral */}
      <div className="text-7xl font-black mb-2">{uncategorizedCount}</div>
      <p className="text-muted-foreground text-xl mb-2">transazioni da categorizzare</p>
      <p className="text-foreground/40 text-sm max-w-xs mb-12">
        Le altre {autoCategorizedCount} erano già note. Ci vogliono solo pochi tocchi.
      </p>

      {/* Giroconto education tip (R-OB-06 exact wording) */}
      <div className="w-full max-w-sm rounded-2xl bg-foreground/10 border border-foreground/10 p-5 text-left mb-10">
        <div className="flex gap-3">
          <span className="text-lg" aria-hidden="true">💡</span>
          <p className="text-sm text-foreground/70 leading-relaxed">
            I trasferimenti tra conti e i giroconti vengono esclusi dai totali in dashboard — è normale se i numeri sembrano diversi da quelli che ti aspetti.
          </p>
        </div>
      </div>
    </div>
  )
}
