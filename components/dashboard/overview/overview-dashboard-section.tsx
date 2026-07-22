'use client'

import { useEffect, useState } from 'react'
import type { MonthOverMonthChange, OverviewChartPoint } from '@/lib/dal/overview'
import { KpiRow } from './kpi-row'
import { OverviewChartFilters } from './overview-chart-filters'
import {
  ALLOCATION_KEYS,
  INCOME_KEYS,
  OUT_KEYS,
  type AllocationKey,
  type IncomeKey,
  type OutKey,
} from './overview-chart-utils'
import { DEFAULT_EXCLUDED_CHIPS } from './overview-kpi-derive'
import { OverviewMoversSection } from './overview-movers-section'
import {
  readExcludedChips,
  safeSessionStorage,
  writeExcludedChips,
  type ExcludedChips,
} from './overview-persistence'

type Props = {
  data: OverviewChartPoint[]
  /** Prior-year chart points — KPI YoY deltas recompute under the same selection. */
  prevData: OverviewChartPoint[]
  year: number
  defaultMonthIndex: number
  initialMoversIn: MonthOverMonthChange[]
  initialMoversOut: MonthOverMonthChange[]
  initialMoversAllocation: MonthOverMonthChange[]
  /** v2.6: dashboard-wide tag filter — forwarded to OverviewMoversSection so its
   *  client-side month-switch refetch (fetchMovers) keeps the tag narrowing. */
  tagId?: number
}

function toIncludedSets(excluded: ExcludedChips) {
  return {
    income: new Set(INCOME_KEYS.filter((k) => !excluded.income.includes(k))),
    out: new Set(OUT_KEYS.filter((k) => !excluded.out.includes(k))),
    allocation: new Set(ALLOCATION_KEYS.filter((k) => !excluded.allocation.includes(k))),
  }
}

/**
 * OverviewDashboardSection — dashboard-wide chip selection owner (260711-gfd, option B).
 *
 * The nature chips stopped being chart-local: they now drive the KPI cards AND the
 * chart, so both always tell the same story. Default selection answers the
 * sustainability question — recurring income vs all spending (extraordinary excluded).
 *
 * Persistence (260709-gfz mechanism, reused): the EXCLUDED keys live in sessionStorage,
 * never in the URL. Absence of a stored value now means the sustainability DEFAULT,
 * not all-on. Defaults render on SSR; the persisted selection is applied post-mount,
 * so there is never an SSR/client mismatch.
 */
export function OverviewDashboardSection({
  data,
  prevData,
  year,
  defaultMonthIndex,
  initialMoversIn,
  initialMoversOut,
  initialMoversAllocation,
  tagId,
}: Props) {
  const defaults = toIncludedSets(DEFAULT_EXCLUDED_CHIPS)
  const [includedIncome, setIncludedIncome] = useState<Set<IncomeKey>>(defaults.income)
  const [includedOut, setIncludedOut] = useState<Set<OutKey>>(defaults.out)
  const [includedAllocation, setIncludedAllocation] = useState<Set<AllocationKey>>(
    defaults.allocation
  )

  // Restore runs once post-mount and never writes — no read/write race with persist().
  // setState-in-effect is deliberate here: SSR must render the deterministic default,
  // and the persisted selection can only be applied after hydration (260709-gfz pattern).
  useEffect(() => {
    const excluded = readExcludedChips(safeSessionStorage())
    if (!excluded) return
    const sets = toIncludedSets(excluded)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIncludedIncome(sets.income)
    setIncludedOut(sets.out)
    setIncludedAllocation(sets.allocation)
  }, [])

  // Persist the EXCLUDED keys. Called from user-action handlers only.
  function persist(income: Set<IncomeKey>, out: Set<OutKey>, allocation: Set<AllocationKey>) {
    writeExcludedChips(safeSessionStorage(), {
      income: INCOME_KEYS.filter((k) => !income.has(k)),
      out: OUT_KEYS.filter((k) => !out.has(k)),
      allocation: ALLOCATION_KEYS.filter((k) => !allocation.has(k)),
    })
  }

  // D-07: inclusive toggle — adds or removes a single key from the included set.
  function handleToggleIncome(key: IncomeKey) {
    const next = new Set(includedIncome)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setIncludedIncome(next)
    persist(next, includedOut, includedAllocation)
  }

  function handleToggleOut(key: OutKey) {
    const next = new Set(includedOut)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setIncludedOut(next)
    persist(includedIncome, next, includedAllocation)
  }

  function handleToggleAllocation(key: AllocationKey) {
    const next = new Set(includedAllocation)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setIncludedAllocation(next)
    persist(includedIncome, includedOut, next)
  }

  // D-08 revisited: reset restores the sustainability DEFAULT (not all-on) — one
  // chip click re-enables Straordinarie for the total picture.
  function handleReset() {
    const sets = toIncludedSets(DEFAULT_EXCLUDED_CHIPS)
    setIncludedIncome(sets.income)
    setIncludedOut(sets.out)
    setIncludedAllocation(sets.allocation)
    persist(sets.income, sets.out, sets.allocation)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Chips above the cards — they govern everything below (cards + chart). */}
      <OverviewChartFilters
        includedIncome={includedIncome}
        includedOut={includedOut}
        includedAllocation={includedAllocation}
        onToggleIncome={handleToggleIncome}
        onToggleOut={handleToggleOut}
        onToggleAllocation={handleToggleAllocation}
        onReset={handleReset}
      />
      <KpiRow
        data={data}
        prevData={prevData}
        includedIncome={includedIncome}
        includedOut={includedOut}
        includedAllocation={includedAllocation}
        year={year}
      />
      <OverviewMoversSection
        data={data}
        tagId={tagId}
        year={year}
        defaultMonthIndex={defaultMonthIndex}
        initialMoversIn={initialMoversIn}
        initialMoversOut={initialMoversOut}
        initialMoversAllocation={initialMoversAllocation}
        includedIncome={includedIncome}
        includedOut={includedOut}
        includedAllocation={includedAllocation}
      />
    </div>
  )
}
