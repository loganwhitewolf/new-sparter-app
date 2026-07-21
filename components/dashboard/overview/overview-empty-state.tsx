type OverviewEmptyStateProps = {
  variant: 'no-years' | 'no-data-for-year' | 'no-data-for-tag'
  year?: number
}

/**
 * Renders an explicit empty-state message for the overview tab (D-06).
 * Shown instead of raw zeros when there is no data to display.
 *
 * variant 'no-years'        — account has no transactions at all
 * variant 'no-data-for-year' — the selected year has no transactions
 * variant 'no-data-for-tag'  — a tag filter is active with zero matching transactions
 *                              in the browsed period (68-06, 68-UI-SPEC.md Copywriting Contract)
 */
export function OverviewEmptyState({ variant, year }: OverviewEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center text-muted-foreground">
      {variant === 'no-years' ? (
        <>
          <p className="text-base font-medium text-foreground">Nessuna transazione registrata</p>
          <p className="max-w-xs text-sm">
            Inizia importando un estratto conto per vedere le tue finanze qui.
          </p>
        </>
      ) : variant === 'no-data-for-tag' ? (
        <>
          <p className="text-base font-medium text-foreground">
            Nessuna transazione con questo tag nel periodo selezionato
          </p>
          <p className="max-w-xs text-sm">
            Cambia periodo o rimuovi il filtro tag per vedere altri dati.
          </p>
        </>
      ) : (
        <>
          <p className="text-base font-medium text-foreground">
            Nessun dato per il {year}
          </p>
          <p className="max-w-xs text-sm">
            Non ci sono transazioni registrate per questo anno. Prova a selezionare un anno
            diverso.
          </p>
        </>
      )}
    </div>
  )
}
