'use client'
// VARIANT B — Due sezioni ETICHETTATE affiancate: "FILTRI" | "ORDINAMENTO". Header non cliccabili.
import {
  AmountRange,
  CategorySelect,
  ChipsRow,
  MockTable,
  MonthPicker,
  PlatformSelect,
  SearchInput,
  SortControl,
  StatusSelect,
  useTableState,
} from './shared'

export function VariantB() {
  const t = useTableState()

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">B — Due sezioni etichettate</h1>
        <p className="text-sm text-muted-foreground">
          Separazione <strong>verbale ed esplicita</strong>: un blocco “FILTRI” e un blocco “ORDINAMENTO” distinti e affiancati.
          Gli header della tabella non ordinano. L’utente legge cosa sta facendo.
        </p>
      </header>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <section className="rounded-xl border p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filtri</h2>
          <div className="flex flex-wrap items-end gap-3">
            <SearchInput value={t.state.q} onChange={(v) => t.set('q', v)} className="min-w-[200px] flex-1" />
            <MonthPicker value={t.state.months} onChange={(v) => t.set('months', v)} />
            <AmountRange
              min={t.state.amountMin}
              max={t.state.amountMax}
              onMin={(v) => t.set('amountMin', v)}
              onMax={(v) => t.set('amountMax', v)}
            />
            <CategorySelect value={t.state.category} onChange={(v) => t.set('category', v)} className="w-44" />
            <PlatformSelect value={t.state.platform} onChange={(v) => t.set('platform', v)} className="w-40" />
            <StatusSelect value={t.state.status} onChange={(v) => t.set('status', v)} className="w-44" />
          </div>
        </section>

        <section className="rounded-xl border bg-muted/30 p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ordinamento</h2>
          <SortControl
            sort={t.state.sort}
            dir={t.state.dir}
            onSort={(s) => t.set('sort', s)}
            onToggleDir={() => t.set('dir', t.state.dir === 'asc' ? 'desc' : 'asc')}
          />
        </section>
      </div>

      <ChipsRow chips={t.chips} onClear={t.clearAll} />
      <MockTable rows={t.filtered} />
    </div>
  )
}
