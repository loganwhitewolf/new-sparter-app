'use client'
// PROTOTYPE — wipe me. Shared mock table + filter/sort controls.
// Variants differ in how they ARRANGE these (the question); the widgets themselves are shared.

import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { ALL_CATEGORIES, ALL_MONTHS, ALL_PLATFORMS, MOCK_ROWS, type Row } from './mock-data'

// ---------- formatters ----------
const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const dateFmt = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
export function fmtAmount(n: number) {
  return euro.format(n)
}
export function fmtDate(iso: string) {
  return dateFmt.format(new Date(iso))
}
export function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const label = new Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric' }).format(new Date(y, m - 1, 1))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// ---------- state ----------
export type SortKey = 'date' | 'amount' | 'description' | 'category' | 'platform' | 'status'
export type Dir = 'asc' | 'desc'

// Italian, case- and accent-insensitive; numeric:true so "€2" < "€10".
const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true })
function statusKey(r: Row) {
  return r.categorized ? '1-categorizzata' : '0-da categorizzare' // uncategorized first when asc (actionable)
}
function compareRows(a: Row, b: Row, key: SortKey): number {
  switch (key) {
    case 'amount':
      return a.amount - b.amount
    case 'date':
      return a.date.localeCompare(b.date)
    case 'description':
      return collator.compare(a.description, b.description)
    case 'category':
      return collator.compare(a.category, b.category)
    case 'platform':
      return collator.compare(a.platform, b.platform)
    case 'status':
      return collator.compare(statusKey(a), statusKey(b))
  }
}
export type Status = '' | 'categorized' | 'uncategorized'

export type State = {
  q: string
  months: string[]
  amountMin: string
  amountMax: string
  category: string
  platform: string
  status: Status
  sort: SortKey
  dir: Dir
}

const DEFAULT: State = {
  q: '',
  months: [],
  amountMin: '',
  amountMax: '',
  category: '',
  platform: '',
  status: '',
  sort: 'date',
  dir: 'desc',
}

export type Chip = { key: string; label: string; onRemove: () => void }

export function useTableState() {
  const [state, setState] = useState<State>(DEFAULT)
  const set = <K extends keyof State>(k: K, v: State[K]) => setState((s) => ({ ...s, [k]: v }))

  const filtered = useMemo(() => {
    let rows = MOCK_ROWS.filter((row) => {
      if (state.q && !row.description.toLowerCase().includes(state.q.toLowerCase())) return false
      if (state.months.length > 0 && !state.months.includes(row.date.slice(0, 7))) return false
      // "Importo" filters on magnitude (sign carries direction) — a question the proto surfaces.
      const mag = Math.abs(row.amount)
      if (state.amountMin && mag < Number(state.amountMin)) return false
      if (state.amountMax && mag > Number(state.amountMax)) return false
      if (state.category && row.category !== state.category) return false
      if (state.platform && row.platform !== state.platform) return false
      if (state.status === 'categorized' && !row.categorized) return false
      if (state.status === 'uncategorized' && row.categorized) return false
      return true
    })
    const f = state.dir === 'asc' ? 1 : -1
    rows = [...rows].sort((a, b) => {
      const primary = compareRows(a, b, state.sort)
      if (primary !== 0) return primary * f
      return a.id.localeCompare(b.id) * f // tiebreaker id (locked decision)
    })
    return rows
  }, [state])

  const chips: Chip[] = []
  if (state.q) chips.push({ key: 'q', label: `Cerca: "${state.q}"`, onRemove: () => set('q', '') })
  if (state.months.length)
    chips.push({ key: 'months', label: `Mesi: ${state.months.map(monthLabel).join(', ')}`, onRemove: () => set('months', []) })
  if (state.amountMin || state.amountMax)
    chips.push({
      key: 'amount',
      label: `Importo: ${state.amountMin || '0'}–${state.amountMax || '∞'} €`,
      onRemove: () => setState((s) => ({ ...s, amountMin: '', amountMax: '' })),
    })
  if (state.category) chips.push({ key: 'category', label: `Categoria: ${state.category}`, onRemove: () => set('category', '') })
  if (state.platform) chips.push({ key: 'platform', label: `Piattaforma: ${state.platform}`, onRemove: () => set('platform', '') })
  if (state.status)
    chips.push({
      key: 'status',
      label: state.status === 'categorized' ? 'Solo categorizzate' : 'Solo da categorizzare',
      onRemove: () => set('status', ''),
    })

  const clearAll = () => setState((s) => ({ ...DEFAULT, sort: s.sort, dir: s.dir }))

  return { state, set, setState, filtered, chips, clearAll }
}

// ---------- shared controls ----------
export function SearchInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Nome o descrizione…"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="pl-9"
      />
    </div>
  )
}

const MONTH_ABBR = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

function PresetBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="rounded-full border bg-secondary px-2.5 py-1 text-xs hover:bg-secondary/70">
      {children}
    </button>
  )
}

// Year-grid month picker: scales to N years (switch year), only months-with-data are enabled,
// "Tutto l'anno" + relative presets as the fast path. Multi-select preserved (ADR 0009).
export function MonthPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const monthsWithData = useMemo(() => new Set(ALL_MONTHS), [])
  const years = useMemo(() => Array.from(new Set(ALL_MONTHS.map((m) => m.slice(0, 4)))).sort().reverse(), [])
  const latestYear = years[0]
  const [viewYear, setViewYear] = useState(latestYear)

  const yearIdx = years.indexOf(viewYear)
  const goYear = (d: number) => {
    const i = yearIdx + d
    if (i >= 0 && i < years.length) setViewYear(years[i])
  }

  const toggle = (ym: string) => onChange(value.includes(ym) ? value.filter((x) => x !== ym) : [...value, ym])
  const yearMonths = ALL_MONTHS.filter((m) => m.startsWith(viewYear))
  const allYearSelected = yearMonths.length > 0 && yearMonths.every((m) => value.includes(m))
  const toggleYear = () =>
    allYearSelected
      ? onChange(value.filter((m) => !m.startsWith(viewYear)))
      : onChange(Array.from(new Set([...value, ...yearMonths])))

  const last3 = ALL_MONTHS.slice(0, 3)
  const thisYear = ALL_MONTHS.filter((m) => m.startsWith(latestYear))
  const lastYear = ALL_MONTHS.filter((m) => m.startsWith(String(Number(latestYear) - 1)))

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between">
          {value.length ? `${value.length} mes${value.length > 1 ? 'i' : 'e'}` : 'Mesi'}
          <span className="ml-2 text-muted-foreground">▾</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-3">
        <div className="flex flex-wrap gap-1.5">
          <PresetBtn onClick={() => onChange(last3)}>Ultimi 3 mesi</PresetBtn>
          <PresetBtn onClick={() => onChange(thisYear)}>Quest&apos;anno</PresetBtn>
          {lastYear.length > 0 && <PresetBtn onClick={() => onChange(lastYear)}>Anno scorso</PresetBtn>}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={() => goYear(1)} disabled={yearIdx >= years.length - 1} className="px-2 text-lg leading-none disabled:opacity-30">
            ‹
          </button>
          <span className="font-medium">{viewYear}</span>
          <button onClick={() => goYear(-1)} disabled={yearIdx <= 0} className="px-2 text-lg leading-none disabled:opacity-30">
            ›
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1">
          {MONTH_ABBR.map((abbr, mi) => {
            const ym = `${viewYear}-${String(mi + 1).padStart(2, '0')}`
            const hasData = monthsWithData.has(ym)
            const selected = value.includes(ym)
            return (
              <button
                key={ym}
                disabled={!hasData}
                onClick={() => toggle(ym)}
                className={cn(
                  'rounded-md border px-2 py-2 text-sm',
                  !hasData && 'cursor-not-allowed border-dashed text-muted-foreground/30',
                  hasData && !selected && 'hover:bg-muted',
                  selected && 'border-primary bg-primary text-primary-foreground',
                )}
              >
                {abbr}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={toggleYear} disabled={yearMonths.length === 0} className="text-sm text-primary disabled:opacity-30">
            {allYearSelected ? `Deseleziona ${viewYear}` : `Tutto il ${viewYear}`}
          </button>
          <span className="text-xs text-muted-foreground">{value.length} selez.</span>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function AmountRange({
  min,
  max,
  onMin,
  onMax,
}: {
  min: string
  max: string
  onMin: (v: string) => void
  onMax: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Input type="number" inputMode="decimal" placeholder="min €" value={min} onChange={(e) => onMin(e.currentTarget.value)} className="w-24" />
      <span className="text-muted-foreground">–</span>
      <Input type="number" inputMode="decimal" placeholder="max €" value={max} onChange={(e) => onMax(e.currentTarget.value)} className="w-24" />
    </div>
  )
}

export function SimpleSelect({
  value,
  onChange,
  placeholder,
  allLabel,
  options,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  allLabel: string
  options: string[]
  className?: string
}) {
  return (
    <Select value={value || 'all'} onValueChange={(v) => onChange(v === 'all' ? '' : v)}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function CategorySelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  return <SimpleSelect value={value} onChange={onChange} placeholder="Categoria" allLabel="Tutte le categorie" options={ALL_CATEGORIES} className={className} />
}
export function PlatformSelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  return <SimpleSelect value={value} onChange={onChange} placeholder="Piattaforma" allLabel="Tutte le piattaforme" options={ALL_PLATFORMS} className={className} />
}
export function StatusSelect({ value, onChange, className }: { value: Status; onChange: (v: Status) => void; className?: string }) {
  return (
    <Select value={value || 'all'} onValueChange={(v) => onChange(v === 'all' ? '' : (v as Status))}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Categorizzazione" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tutte</SelectItem>
        <SelectItem value="categorized">Categorizzate</SelectItem>
        <SelectItem value="uncategorized">Da categorizzare</SelectItem>
      </SelectContent>
    </Select>
  )
}

export function SortControl({
  sort,
  dir,
  onSort,
  onToggleDir,
}: {
  sort: SortKey
  dir: Dir
  onSort: (s: SortKey) => void
  onToggleDir: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Select value={sort} onValueChange={(v) => onSort(v as SortKey)}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="date">Data movimento</SelectItem>
          <SelectItem value="amount">Importo</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" onClick={onToggleDir} aria-label="Inverti direzione">
        {dir === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
        <span>{dir === 'asc' ? 'Crescente' : 'Decrescente'}</span>
      </Button>
    </div>
  )
}

export function ChipsRow({ chips, onClear }: { chips: Chip[]; onClear: () => void }) {
  if (chips.length === 0)
    return <p className="text-sm text-muted-foreground">Nessun filtro attivo — mostro tutte le transazioni, più recenti in cima.</p>
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Filtri attivi:</span>
      {chips.map((c) => (
        <button
          key={c.key}
          onClick={c.onRemove}
          className="inline-flex items-center gap-1 rounded-full border bg-secondary px-3 py-1 text-sm hover:bg-secondary/70"
        >
          {c.label}
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      ))}
      <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
        Cancella tutto
      </Button>
    </div>
  )
}

// ---------- the table (backdrop: real density) ----------
function SortableHead({
  label,
  active,
  dir,
  onClick,
  className,
  align,
}: {
  label: string
  active: boolean
  dir: Dir
  onClick: () => void
  className?: string
  align?: 'right'
}) {
  return (
    <TableHead className={className} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground',
          align === 'right' && 'w-full justify-end',
          active && 'font-semibold text-foreground',
        )}
      >
        {label}
        {active ? dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" /> : <span className="text-muted-foreground/40">↕</span>}
      </button>
    </TableHead>
  )
}

const TH_CLS = 'text-xs font-normal uppercase tracking-wide text-muted-foreground'
const COLUMNS: { key: SortKey; label: string; width?: string; right?: boolean }[] = [
  { key: 'description', label: 'Transazione' },
  { key: 'amount', label: 'Importo', width: 'w-36', right: true },
  { key: 'date', label: 'Data', width: 'w-32', right: true },
  { key: 'category', label: 'Categoria', width: 'w-44' },
  { key: 'platform', label: 'Piattaforma', width: 'w-32' },
  { key: 'status', label: 'Stato', width: 'w-28' },
]

export function MockTable({
  rows,
  headerSort,
  sort,
  dir,
  onSort,
}: {
  rows: Row[]
  headerSort?: boolean
  sort?: SortKey
  dir?: Dir
  onSort?: (s: SortKey) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <Table className="w-full">
        <TableHeader>
          <TableRow className="bg-secondary/70">
            {COLUMNS.map((c) => {
              const cls = cn(c.width, c.right && 'text-right', TH_CLS)
              return headerSort && sort && dir && onSort ? (
                <SortableHead
                  key={c.key}
                  label={c.label}
                  active={sort === c.key}
                  dir={dir}
                  onClick={() => onSort(c.key)}
                  align={c.right ? 'right' : undefined}
                  className={cls}
                />
              ) : (
                <TableHead key={c.key} className={cls}>
                  {c.label}
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-14 text-center text-sm text-muted-foreground">
                Nessun risultato per i filtri selezionati.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/50">
                <TableCell className="max-w-0 truncate">{row.description}</TableCell>
                <TableCell
                  className={cn(
                    'text-right font-mono tabular-nums',
                    row.isTransfer ? 'text-muted-foreground/60' : row.amount < 0 ? 'text-foreground' : 'text-emerald-700',
                  )}
                  title={row.isTransfer ? 'Trasferimento — non muove il patrimonio' : undefined}
                >
                  {fmtAmount(row.amount)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">{fmtDate(row.date)}</TableCell>
                <TableCell className="truncate text-sm">
                  {row.category}
                  <span className="block truncate text-xs text-muted-foreground">{row.subcategory}</span>
                </TableCell>
                <TableCell className="text-sm">{row.platform}</TableCell>
                <TableCell>
                  {row.categorized ? (
                    <Badge variant="outline" className="border-0 bg-emerald-100 text-emerald-700">
                      Categorizzata
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-0 bg-amber-100 text-amber-700">
                      Da categorizzare
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <div className="border-t px-4 py-2 text-center text-xs text-muted-foreground">{rows.length} transazioni</div>
    </div>
  )
}
