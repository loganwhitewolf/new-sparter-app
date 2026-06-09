'use client'

import { Info } from 'lucide-react'
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
import { INCOME_KEYS, OUT_KEYS, type IncomeKey, type OutKey } from './overview-chart-utils'

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
 * The `extraordinary` OUT key maps to NATURE_LABELS['extraordinary'] (not income_extraordinary).
 */
const OUT_NATURE_KEY_MAP: Record<OutKey, keyof typeof NATURE_LABELS> = {
  essential: 'essential',
  discretionary: 'discretionary',
  operational: 'operational',
  financial: 'financial',
  debt: 'debt',
  extraordinary: 'extraordinary',
}

/**
 * One-line Italian tooltip definition for each out chip (EDU-02).
 */
const OUT_CHIP_TOOLTIPS: Record<OutKey, string> = {
  essential: NATURE_LABELS['essential'] + ' — spese necessarie come affitto, cibo, bollette',
  discretionary: NATURE_LABELS['discretionary'] + ' — acquisti facoltativi e svago',
  operational: NATURE_LABELS['operational'] + ' — abbonamenti, commissioni, costi operativi',
  financial: NATURE_LABELS['financial'] + ' — investimenti, tasse, spese finanziarie',
  debt: NATURE_LABELS['debt'] + ' — rate, mutui, rimborsi di prestiti',
  extraordinary: NATURE_LABELS['extraordinary'] + ' — spese una-tantum non ricorrenti',
}

// ─── Props ────────────────────────────────────────────────────────────────────

type OverviewChartFiltersProps = {
  /** Currently included income keys (controlled by parent OverviewChart). */
  includedIncome: Set<IncomeKey>
  /** Currently included out keys (controlled by parent OverviewChart). */
  includedOut: Set<OutKey>
  /** Toggle an income key in/out of the included set. */
  onToggleIncome: (key: IncomeKey) => void
  /** Toggle an out key in/out of the included set. */
  onToggleOut: (key: OutKey) => void
  /** Reset both filter groups to all-included default state. */
  onReset?: () => void
}

// ─── Internal chip component ──────────────────────────────────────────────────

type ChipProps = {
  label: string
  tooltip: string
  /** Chart series color shown as a leading dot — doubles as the legend key. */
  color: string
  included: boolean
  onToggle: () => void
}

function FilterChip({ label, tooltip, color, included, onToggle }: ChipProps) {
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
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: color, opacity: included ? 1 : 0.4 }}
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
 * Renders two labelled groups:
 * - Entrate: income chips (Ricorrenti / Straordinarie) + group info popover (EDU-01)
 * - Uscite: six expense-nature chips from OUT_KEYS + group info popover (EDU-01)
 *
 * Each chip is an aria-pressed toggle button with a one-line tooltip (EDU-02).
 * Chip state is owned by the parent; this is a purely controlled component.
 */
export function OverviewChartFilters({
  includedIncome,
  includedOut,
  onToggleIncome,
  onToggleOut,
  onReset,
}: OverviewChartFiltersProps) {
  const allIncluded =
    includedIncome.size === INCOME_KEYS.length &&
    includedOut.size === OUT_KEYS.length

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
              included={includedIncome.has(key)}
              onToggle={() => onToggleIncome(key)}
            />
          ))}
        </div>

        {/* Uscite group */}
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
                  Filtra la barra rossa per natura della spesa. Ogni chip include o esclude
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
              included={includedOut.has(key)}
              onToggle={() => onToggleOut(key)}
            />
          ))}
        </div>

        {/* Reset affordance (D-08: lightweight reset when any chip is excluded) */}
        {onReset && !allIncluded && (
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
