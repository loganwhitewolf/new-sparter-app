import type { CategoryDetailTopTransaction } from '@/lib/dal/dashboard'

type Props = {
  transactions: CategoryDetailTopTransaction[]
}

const currencyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
})

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function formatAmount(value: string): string {
  const amount = Number(value)
  return currencyFormatter.format(Number.isFinite(amount) ? Math.abs(amount) : 0)
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? 'Data non disponibile' : dateFormatter.format(date)
}

function displayTitle(transaction: CategoryDetailTopTransaction): string {
  const title = transaction.title.trim()
  const description = transaction.description.trim()
  return title || description || 'Movimento senza descrizione'
}

export function CategoryTopTransactions({ transactions }: Props) {
  const visibleTransactions = transactions.slice(0, 5)

  if (visibleTransactions.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-medium">Nessun movimento da mostrare</p>
          <p className="text-sm text-muted-foreground">
            I movimenti più rilevanti compariranno quando questa categoria avrà dati nel periodo.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ol className="grid gap-3" aria-label="Top 5 movimenti categoria">
      {visibleTransactions.map((transaction, index) => {
        const title = displayTitle(transaction)
        const description = transaction.description.trim()

        return (
          <li key={transaction.id} className="overflow-hidden rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground" title={title}>
                    {title}
                  </p>
                  {description && description !== title ? (
                    <p className="mt-1 truncate text-xs text-muted-foreground" title={description}>
                      {description}
                    </p>
                  ) : null}
                  <time className="mt-1 block truncate text-xs text-muted-foreground" dateTime={transaction.date}>
                    {formatDate(transaction.date)}
                  </time>
                </div>
              </div>

              <p className="w-20 shrink-0 text-right font-mono text-sm font-semibold tabular-nums text-total-out">
                {formatAmount(transaction.amount)}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
