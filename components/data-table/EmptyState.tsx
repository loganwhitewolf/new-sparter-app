import { Card, CardContent } from '@/components/ui/card'

type Props = {
  variant: 'no-data' | 'no-result'
  /** Optional custom message for the primary text line */
  message?: string
  /** Optional custom hint for the secondary text line */
  hint?: string
}

/**
 * EmptyState — renders an empty-table placeholder card.
 *
 * Variants:
 *   - `no-data`   — the table has zero rows regardless of filters (e.g. fresh account,
 *                   no imports yet). Default primary label is the Italian product string
 *                   for "No data".
 *   - `no-result` — rows exist in the data set but the active filters exclude them all.
 *                   Default primary label is the Italian product string for "No results";
 *                   hint encourages relaxing filters.
 *
 * Custom `message` / `hint` strings override the defaults for per-table phrasing.
 */
export function EmptyState({ variant, message, hint }: Props) {
  const primaryText =
    message ??
    (variant === 'no-result' ? 'Nessun risultato' : 'Nessun dato')

  const secondaryText =
    hint ??
    (variant === 'no-result'
      ? 'Nessun elemento corrisponde ai filtri attivi. Prova a modificare o rimuovere i filtri.'
      : 'Non ci sono ancora dati da mostrare.')

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
        <p className="text-base font-medium text-foreground">{primaryText}</p>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{secondaryText}</p>
      </CardContent>
    </Card>
  )
}
