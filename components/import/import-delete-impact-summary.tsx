import type { ImportDeletePreview } from '@/lib/services/import-deletion'
import { cn } from '@/lib/utils'

type Props = {
  preview: ImportDeletePreview
  className?: string
}

type ImpactItem = {
  label: string
  value: number
  tone: 'neutral' | 'warning' | 'danger' | 'safe'
}

function singularOrPlural(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

function impactItems(preview: ImportDeletePreview): ImpactItem[] {
  return [
    {
      label: singularOrPlural(preview.counts.transactions, 'transazione importata', 'transazioni importate'),
      value: preview.counts.transactions,
      tone: 'danger',
    },
    {
      label: singularOrPlural(preview.counts.affectedExpenses, 'spesa interessata', 'spese interessate'),
      value: preview.counts.affectedExpenses,
      tone: 'warning',
    },
    {
      label: singularOrPlural(preview.counts.recalculatedExpenses, 'spesa ricalcolata', 'spese ricalcolate'),
      value: preview.counts.recalculatedExpenses,
      tone: 'neutral',
    },
    {
      label: singularOrPlural(preview.counts.deletedExpenses, 'spesa vuota eliminata', 'spese vuote eliminate'),
      value: preview.counts.deletedExpenses,
      tone: 'danger',
    },
    {
      label: singularOrPlural(
        preview.counts.preservedExpenses,
        'spesa manuale o corretta preservata',
        'spese manuali o corrette preservate',
      ),
      value: preview.counts.preservedExpenses,
      tone: 'safe',
    },
  ]
}

const toneClasses: Record<ImpactItem['tone'], string> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-red-200 bg-red-50 text-red-900',
  safe: 'border-emerald-200 bg-emerald-50 text-emerald-900',
}

export function ImportDeleteImpactSummary({ preview, className }: Props) {
  const preservedCount = preview.counts.preservedExpenses

  return (
    <section
      className={cn('rounded-lg border border-border bg-background p-4', className)}
      aria-labelledby="import-delete-impact-title"
    >
      <div className="space-y-1">
        <h3 id="import-delete-impact-title" className="text-sm font-semibold text-foreground">
          Impatto dell’eliminazione
        </h3>
        <p className="text-sm text-muted-foreground">
          Prima di eliminare <span className="font-medium text-foreground">{preview.displayName}</span>,
          controlla cosa verrà rimosso o aggiornato.
        </p>
      </div>

      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        {impactItems(preview).map((item) => (
          <div key={item.label} className={cn('rounded-md border px-3 py-2', toneClasses[item.tone])}>
            <dt className="text-xs font-medium uppercase tracking-wide opacity-75">{item.label}</dt>
            <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
        {preservedCount > 0
          ? 'Le spese vuote con storico di classificazione manuale o override vengono preservate per non perdere le correzioni esplicite.'
          : 'Non ci sono spese manuali o override da preservare: le spese vuote non manuali verranno eliminate se restano senza transazioni.'}
      </p>
    </section>
  )
}
