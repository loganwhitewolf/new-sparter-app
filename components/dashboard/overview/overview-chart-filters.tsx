'use client'

import { Info, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { NATURE_COLORS, NATURE_LABELS } from '@/lib/utils/nature-labels'
import { INCOME_KEYS, OUT_KEYS, ALLOCATION_KEYS, type IncomeKey, type OutKey, type AllocationKey } from './overview-chart-utils'
import { DEFAULT_EXCLUDED_CHIPS } from './overview-kpi-derive'
import { NATURE_ICONS } from './nature-icons'

// ─── Chip label helpers ───────────────────────────────────────────────────────

/**
 * Short display label for each income key.
 * PATTERNS.md D-05: shorten income chips to "Ricorrenti" / "Straordinarie".
 */
const INCOME_CHIP_LABELS: Record<IncomeKey, string> = {
  recurring: 'Ricorrenti',
  extraordinary: 'Straordinarie',
}

/**
 * Chart series color for each income chip — the dot doubles as the chart legend
 * key, so the user recognises which bar segment a chip controls (FRU-FIX-06).
 */
const INCOME_CHIP_COLORS: Record<IncomeKey, string> = {
  recurring: NATURE_COLORS['income'],
  extraordinary: NATURE_COLORS['income_extraordinary'],
}

/**
 * One-line Italian tooltip definition for each income chip (EDU-02).
 * Descriptions are concise and derived from NATURE_LABELS + Phase 42 income split.
 */
const INCOME_CHIP_TOOLTIPS: Record<IncomeKey, string> = {
  recurring: NATURE_LABELS['income'] + ' — stipendi, canoni, entrate periodiche',
  extraordinary: NATURE_LABELS['income_extraordinary'] + ' — bonus, rimborsi, entrate non periodiche',
}

/**
 * Mapping from OutKey to the NATURE_LABELS key.
 * Phase 49: OUT_KEYS is now essential/discretionary/debt only.
 */
const OUT_NATURE_KEY_MAP: Record<OutKey, keyof typeof NATURE_LABELS> = {
  essential: 'essential',
  discretionary: 'discretionary',
  debt: 'debt',
}

/**
 * One-line Italian tooltip definition for each out chip (EDU-02).
 * Phase 49: spending natures only (savings/investment/transfer moved to their own bar).
 */
const OUT_CHIP_TOOLTIPS: Record<OutKey, string> = {
  essential: NATURE_LABELS['essential'] + ' — spese necessarie come affitto, cibo, bollette',
  discretionary: NATURE_LABELS['discretionary'] + ' — acquisti facoltativi e svago',
  debt: NATURE_LABELS['debt'] + ' — rate, mutui, rimborsi di prestiti',
}

// ─── Allocation chip definitions ─────────────────────────────────────────────

type AllocationChipKey = 'savings' | 'investment'

const ALLOCATION_CHIPS: Array<{ key: AllocationChipKey; label: string; tooltip: string; color: string }> = [
  {
    key: 'savings',
    label: 'Risparmio',
    tooltip: NATURE_LABELS['savings'] + ' — risparmi accantonati',
    color: NATURE_COLORS['savings'],
  },
  {
    key: 'investment',
    label: 'Investimento',
    tooltip: NATURE_LABELS['investment'] + ' — investimenti, azioni, fondi comuni',
    color: NATURE_COLORS['investment'],
  },
]

// ─── Props ────────────────────────────────────────────────────────────────────

type OverviewChartFiltersProps = {
  /** Currently included income keys (controlled by parent OverviewChart). */
  includedIncome: Set<IncomeKey>
  /** Currently included out keys (controlled by parent OverviewChart). */
  includedOut: Set<OutKey>
  /** Currently included allocation keys (controlled by parent OverviewChart). */
  includedAllocation: Set<AllocationKey>
  /** Toggle an income key in/out of the included set. */
  onToggleIncome: (key: IncomeKey) => void
  /** Toggle an out key in/out of the included set. */
  onToggleOut: (key: OutKey) => void
  /** Toggle an allocation key in/out of the included set. */
  onToggleAllocation: (key: AllocationKey) => void
  /** Reset all filter groups to the dashboard default selection (260711-gfd). */
  onReset?: () => void
}

// ─── Internal chip component ──────────────────────────────────────────────────

type ChipProps = {
  label: string
  tooltip: string
  /** Nature identity colour — tints the icon; doubles as the chart legend key. */
  color: string
  /** Shared nature icon — the same glyph appears under the KPI composition bars. */
  icon: LucideIcon
  included: boolean
  onToggle: () => void
}

function FilterChip({ label, tooltip, color, icon: Icon, included, onToggle }: ChipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-pressed={included}
          onClick={onToggle}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            included
              ? 'border-transparent bg-foreground/10 text-foreground hover:bg-foreground/20'
              : 'border-border bg-background text-muted-foreground line-through hover:bg-muted'
          )}
        >
          <Icon
            className="size-3.5 shrink-0"
            style={{ color, opacity: included ? 1 : 0.4 }}
            aria-hidden="true"
          />
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * OverviewChartFilters — controlled chip groups for slicing the OverviewChart bars.
 *
 * Renders three labelled groups:
 * - Entrate: income chips (Ricorrenti / Straordinarie) + group info popover (EDU-01)
 * - Uscite: spending-nature chips (Essenziale / Discrezionale / Debiti) + group info popover
 * - Accantonamento: allocation chips (Risparmio / Investimento) — display-only, no toggle
 *
 * Each chip is an aria-pressed toggle button with a one-line tooltip (EDU-02).
 * Chip state is owned by the parent; this is a purely controlled component.
 */
export function OverviewChartFilters({
  includedIncome,
  includedOut,
  includedAllocation,
  onToggleIncome,
  onToggleOut,
  onToggleAllocation,
  onReset,
}: OverviewChartFiltersProps) {
  // Reset affordance shows only when the selection differs from the DEFAULT —
  // since 260711-gfd the default is the sustainability selection (extraordinary
  // excluded), so "all-on" is itself a non-default state that offers Reimposta.
  const isDefaultSelection =
    INCOME_KEYS.every(
      (k) => includedIncome.has(k) === !DEFAULT_EXCLUDED_CHIPS.income.includes(k)
    ) &&
    OUT_KEYS.every((k) => includedOut.has(k) === !DEFAULT_EXCLUDED_CHIPS.out.includes(k)) &&
    ALLOCATION_KEYS.every(
      (k) => includedAllocation.has(k) === !DEFAULT_EXCLUDED_CHIPS.allocation.includes(k)
    )

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 text-sm">

        {/* Entrate group */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-muted-foreground">Entrate</span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Informazioni sul gruppo Entrate"
                  className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Info className="size-3" aria-hidden="true" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 text-sm">
                <p className="font-medium">Entrate</p>
                <p className="mt-1 text-muted-foreground">
                  Filtra la barra verde per tipo di entrata. Le entrate ricorrenti sono
                  periodiche (stipendi, canoni); quelle straordinarie sono occasionali (bonus, rimborsi).
                </p>
              </PopoverContent>
            </Popover>
          </div>
          {INCOME_KEYS.map((key) => (
            <FilterChip
              key={key}
              label={INCOME_CHIP_LABELS[key]}
              tooltip={INCOME_CHIP_TOOLTIPS[key]}
              color={INCOME_CHIP_COLORS[key]}
              icon={NATURE_ICONS[key]}
              included={includedIncome.has(key)}
              onToggle={() => onToggleIncome(key)}
            />
          ))}
        </div>

        {/* Uscite group — spending natures only (essential/discretionary/debt) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-muted-foreground">Uscite</span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Informazioni sul gruppo Uscite"
                  className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Info className="size-3" aria-hidden="true" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 text-sm">
                <p className="font-medium">Uscite</p>
                <p className="mt-1 text-muted-foreground">
                  Filtra la barra arancione per natura della spesa. Ogni chip include o esclude
                  quel tipo di uscita dal totale mensile del grafico.
                </p>
              </PopoverContent>
            </Popover>
          </div>
          {OUT_KEYS.map((key) => (
            <FilterChip
              key={key}
              label={NATURE_LABELS[OUT_NATURE_KEY_MAP[key]]}
              tooltip={OUT_CHIP_TOOLTIPS[key]}
              color={NATURE_COLORS[OUT_NATURE_KEY_MAP[key]]}
              icon={NATURE_ICONS[key]}
              included={includedOut.has(key)}
              onToggle={() => onToggleOut(key)}
            />
          ))}
        </div>

        {/* Accantonamento group — Risparmio / Investimento (toggleable) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-muted-foreground">Accantonamento</span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Informazioni sul gruppo Accantonamento"
                  className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Info className="size-3" aria-hidden="true" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 text-sm">
                <p className="font-medium">Accantonamento</p>
                <p className="mt-1 text-muted-foreground">
                  Filtra la barra viola per tipo di accantonamento. Ogni chip include o esclude
                  risparmio o investimento dal totale mensile del grafico.
                </p>
              </PopoverContent>
            </Popover>
          </div>
          {ALLOCATION_CHIPS.map((chip) => (
            <FilterChip
              key={chip.key}
              label={chip.label}
              tooltip={chip.tooltip}
              color={chip.color}
              icon={NATURE_ICONS[chip.key]}
              included={includedAllocation.has(chip.key)}
              onToggle={() => onToggleAllocation(chip.key)}
            />
          ))}
        </div>

        {/* Reset affordance (D-08 revisited): shown when the selection differs from
            the sustainability default; reset returns to that default, not all-on. */}
        {onReset && !isDefaultSelection && (
          <button
            type="button"
            onClick={onReset}
            className="self-center rounded px-2 py-0.5 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Reimposta
          </button>
        )}

      </div>
    </TooltipProvider>
  )
}
