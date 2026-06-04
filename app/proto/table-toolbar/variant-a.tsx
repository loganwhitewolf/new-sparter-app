'use client'
// VARIANT A — Ordinamento SOLO sugli header. Filtri in un pannello. Separazione massima.
import type { ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  AmountRange,
  CategorySelect,
  ChipsRow,
  MockTable,
  MonthPicker,
  PlatformSelect,
  SearchInput,
  StatusSelect,
  useTableState,
  type SortKey,
} from './shared'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export function VariantA() {
  const t = useTableState()
  const n = t.chips.length

  function onHeaderSort(s: SortKey) {
    if (t.state.sort === s) t.set('dir', t.state.dir === 'asc' ? 'desc' : 'asc')
    else t.setState((p) => ({ ...p, sort: s, dir: 'desc' }))
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">A — Ordinamento sulla tabella</h1>
        <p className="text-sm text-muted-foreground">
          Filtri nel pannello “Filtri”. Ordinamento <strong>solo</strong> cliccando gli header (Importo, Data). Nessun controllo
          di sort nella toolbar → l’affordance “clicco l’intestazione = ordino” fa tutto.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={t.state.q} onChange={(v) => t.set('q', v)} className="min-w-[240px] flex-1" />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <SlidersHorizontal className="h-4 w-4" />
              Filtri{n ? ` (${n})` : ''}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 space-y-3">
            <Field label="Mesi">
              <MonthPicker value={t.state.months} onChange={(v) => t.set('months', v)} />
            </Field>
            <Field label="Importo (€)">
              <AmountRange
                min={t.state.amountMin}
                max={t.state.amountMax}
                onMin={(v) => t.set('amountMin', v)}
                onMax={(v) => t.set('amountMax', v)}
              />
            </Field>
            <Field label="Categoria">
              <CategorySelect value={t.state.category} onChange={(v) => t.set('category', v)} className="w-full" />
            </Field>
            <Field label="Piattaforma">
              <PlatformSelect value={t.state.platform} onChange={(v) => t.set('platform', v)} className="w-full" />
            </Field>
            <Field label="Categorizzazione">
              <StatusSelect value={t.state.status} onChange={(v) => t.set('status', v)} className="w-full" />
            </Field>
          </PopoverContent>
        </Popover>
      </div>

      <ChipsRow chips={t.chips} onClear={t.clearAll} />
      <MockTable rows={t.filtered} headerSort sort={t.state.sort} dir={t.state.dir} onSort={onHeaderSort} />
    </div>
  )
}
