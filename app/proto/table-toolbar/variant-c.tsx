'use client'
// VARIANT C — Un solo ingresso "Filtra e ordina" → pannello con TAB separati (Filtri | Ordina).
import { useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export function VariantC() {
  const t = useTableState()
  const [open, setOpen] = useState(false)
  const n = t.chips.length
  const sortLabel = t.state.sort === 'amount' ? 'Importo' : 'Data movimento'

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">C — Ingresso unico, separazione interna a tab</h1>
        <p className="text-sm text-muted-foreground">
          Una sola barra: ricerca + “Filtra e ordina”. Il pannello tiene Filtri e Ordina su <strong>tab separati</strong>.
          La barra mostra sempre l’ordinamento corrente + i chip dei filtri.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={t.state.q} onChange={(v) => t.set('q', v)} className="min-w-[240px] flex-1" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <SlidersHorizontal className="h-4 w-4" />
              Filtra e ordina{n ? ` (${n})` : ''}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Filtra e ordina</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="filtri">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="filtri">Filtri{n ? ` (${n})` : ''}</TabsTrigger>
                <TabsTrigger value="ordina">Ordina</TabsTrigger>
              </TabsList>
              <TabsContent value="filtri" className="space-y-3 pt-3">
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
              </TabsContent>
              <TabsContent value="ordina" className="space-y-3 pt-3">
                <Field label="Ordina per">
                  <SortControl
                    sort={t.state.sort}
                    dir={t.state.dir}
                    onSort={(s) => t.set('sort', s)}
                    onToggleDir={() => t.set('dir', t.state.dir === 'asc' ? 'desc' : 'asc')}
                  />
                </Field>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        <div className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm text-muted-foreground">
          Ordinato per <strong className="text-foreground">{sortLabel}</strong>
          {t.state.dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
        </div>
      </div>

      <ChipsRow chips={t.chips} onClear={t.clearAll} />
      <MockTable rows={t.filtered} />
    </div>
  )
}
