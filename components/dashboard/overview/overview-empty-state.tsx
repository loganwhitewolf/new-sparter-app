type OverviewEmptyStateProps = {
  variant: 'no-years' | 'no-data-for-year'
  year?: number
}

/**
 * Renders an explicit empty-state message for the overview tab (D-06).
 * Shown instead of raw zeros when there is no data to display.
 *
 * variant 'no-years'        — account has no transactions at all
 * variant 'no-data-for-year' — the selected year has no transactions
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
