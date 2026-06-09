---
phase: 45-overview-movers
verified: 2026-06-09T00:00:00Z
status: human_needed
score: 5/5
overrides_applied: 0
human_verification:
  - test: "Bar click highlights both bars and updates movers panel"
    expected: "Clicking any month's bar sets that month to full opacity (Entrate + Uscite), dims all others to ~40%, and panel content changes to that month's movers"
    why_human: "fillOpacity and panel update are visual/interactive behaviors — grep confirms wiring but cannot confirm runtime behavior"
  - test: "Panel defaults to last month with data on initial load"
    expected: "On first paint, the movers panel is populated and the highlighted bars correspond to the last month that actually has transaction activity — not necessarily the last calendar month"
    why_human: "deriveDefaultMonthIndex logic verified in code; actual defaulting to the correct month requires a running app with real data"
  - test: "Empty section hiding — only one section shows when all movers are in one direction"
    expected: "If a month has only increases, the 'Dove hai risparmiato' section is absent; if only savings, the 'Dove hai speso di più' section is absent"
    why_human: "Conditional rendering verified via grep; actual hiding behavior requires data that produces a one-sided result"
  - test: "Empty state for first available month"
    expected: "Clicking the leftmost month bar (no prior month to compare) shows 'Nessuna variazione significativa — mese di partenza o nessuna spesa sopra €15.' and no mover lists"
    why_human: "Empty-state branch verified in code; confirming it triggers for real first-month data requires browser run"
  - test: "Humanized copy: no percentages, 'spesa nuova' for new spend"
    expected: "Each row renders '{Categoria} | €X in più' / '€X in meno' / '€X spesa nuova' — no % symbols, no arrows"
    why_human: "formatMoverAmount verified to produce correct strings; visual rendering in browser confirmed by 45-03 human checkpoint"
  - test: "URL is unaffected by bar clicks"
    expected: "Clicking different months does NOT change the ?year= URL param"
    why_human: "No revalidatePath/router.push in code — confirmed by grep; URL immutability still best confirmed by manual test"
---

# Phase 45: Overview Movers — Verification Report

**Phase Goal:** Build the per-month movers drill-down on the overview dashboard: clicking a bar highlights that month and shows the top spending changes (increases/savings) in an inline panel below the chart.
**Verified:** 2026-06-09
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clicking a month's bar highlights both bars and updates the movers panel for that month | VERIFIED | `overview-chart.tsx:117,146` — both Bars have `onClick={(_, index) => onMonthSelect(index)}`; `overview-movers-section.tsx:27-36` — `handleMonthSelect` sets `selectedMonth` immediately and triggers `fetchMovers` inside `useTransition` |
| 2 | Movers panel shows red "Dove hai speso di più" and green "Dove hai risparmiato"; empty section hidden | VERIFIED | `overview-movers-panel.tsx:69,93` — `increases.length > 0 &&` and `savings.length > 0 &&` guard both sections; `text-[var(--total-out)]` red and `text-[var(--total-in)]` green confirmed at lines 71, 95 |
| 3 | Each mover reads as a human presentation with "spesa nuova" for new spend; no percentages, no arrows | VERIFIED | Table layout: `m.name` in left span, `formatMoverAmount(m)` in right span produces "€X in più" / "€X in meno" / "€X spesa nuova"; `formatMoverFormat.ts` has zero `%` characters; `formatMoverLine` unit tests (15/15 green) verify no `%` or `→` in output; 45-03 human checkpoint confirmed MOVE-03 |
| 4 | Panel defaults to last month with data on initial load, that month's bars highlighted | VERIFIED | `page.tsx:35-45` — `deriveDefaultMonthIndex` scans chart from end using `toDecimal` arithmetic on `Object.values(p.out)`; `page.tsx:56-58` — pre-fetches movers server-side; `OverviewMoversSection` initializes `useState(defaultMonthIndex)` |
| 5 | First available month shows empty state (no prior month to compare) | VERIFIED | `overview-movers-panel.tsx:59-63` — `!isPending && movers.length === 0` renders "Nessuna variazione significativa — mese di partenza o nessuna spesa sopra €15." |

**Score:** 5/5 truths verified (automated wiring confirmed; visual/interactive behaviors need human confirmation — see Human Verification section)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/actions/overview.ts` | fetchMovers server action wrapping getMonthOverMonthCategoryChanges | VERIFIED | Line 1: `'use server'`; exports `fetchMovers(year, monthIndex)`; `verifySession` called before DAL at line 20; `Number.isInteger` bounds at lines 25-30; no `revalidate` calls; returns `{ movers, error }` never throws |
| `components/dashboard/overview/overview-movers-format.ts` | formatMoverLine + formatMoverAmount + splitMovers | VERIFIED | Exports `formatMoverLine`, `formatMoverAmount`, `splitMovers`; imports `formatEur` from `./format`; no `%` characters; isNew check at line 19; positive/negative branches at lines 26-28 |
| `tests/overview-movers.test.tsx` | Unit coverage for formatMoverLine + splitMovers | VERIFIED | 15 test cases across `describe('formatMoverLine')` and `describe('splitMovers')`; all 15 pass under `npx vitest run` |
| `components/dashboard/overview/overview-movers-section.tsx` | Client parent owning selectedMonth; wraps OverviewChart + OverviewMoversPanel | VERIFIED | `'use client'` line 1; `useState(defaultMonthIndex)`, `useState(initialMovers)`, `useTransition` at lines 23-25; `handleMonthSelect` wires immediate highlight + non-blocking fetch; renders `<OverviewChart ... selectedMonth={selectedMonth} onMonthSelect={handleMonthSelect}>` and `<OverviewMoversPanel ...>` |
| `components/dashboard/overview/overview-movers-panel.tsx` | Presentational two-section panel with empty state and loading state | VERIFIED | `'use client'` line 1; no `useState`/`useTransition`/`fetchMovers` (presentational); uses `splitMovers` + `formatMoverAmount`; `isPending` spinner at line 55; empty state at line 62; section guards at lines 69, 93 |
| `components/dashboard/overview/overview-chart.tsx` | Controlled chart: selectedMonth + onMonthSelect props, Cell highlight on both Bars | VERIFIED | Props `selectedMonth: number` and `onMonthSelect: (monthIndex: number) => void` required at lines 33-34; no internal `setSelectedMonth`; `onClick={(_, index) => onMonthSelect(index)}` on both Bars (lines 117, 146); `fillOpacity={i === selectedMonth ? 1 : 0.4}` on both Cell arrays (lines 133, 162) |
| `app/(app)/dashboard/overview/page.tsx` | deriveDefaultMonthIndex + initial movers prefetch, renders OverviewMoversSection | VERIFIED | `deriveDefaultMonthIndex` defined at line 35 using `Object.values(p.out)` (not `.reduce` on object); called at line 56; `getMonthOverMonthCategoryChanges(year, defaultMonthIndex)` at line 58; `OverviewMoversSection` rendered at line 68; no direct `OverviewChart` import |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/actions/overview.ts` | `lib/dal/overview.ts` | `getMonthOverMonthCategoryChanges` import | VERIFIED | Line 3: `import { getMonthOverMonthCategoryChanges, type MonthOverMonthChange } from '@/lib/dal/overview'`; called at line 35 |
| `lib/actions/overview.ts` | `lib/dal/auth.ts` | `verifySession` at action trust boundary | VERIFIED | Line 2: `import { verifySession } from '@/lib/dal/auth'`; called at line 20 before any DAL access |
| `app/(app)/dashboard/overview/page.tsx` | `components/dashboard/overview/overview-movers-section.tsx` | props: year, defaultMonthIndex, initialMovers, data | VERIFIED | Line 13: import; lines 68-73: rendered with all four props |
| `components/dashboard/overview/overview-movers-section.tsx` | `lib/actions/overview.ts` | fetchMovers in useTransition on month change | VERIFIED | Line 4: import; line 32: `await fetchMovers(year, monthIndex)` inside `startTransition` |
| `components/dashboard/overview/overview-movers-panel.tsx` | `components/dashboard/overview/overview-movers-format.ts` | formatMoverAmount + splitMovers | VERIFIED | Line 5: `import { formatMoverAmount, splitMovers }`; `splitMovers` called at line 44; `formatMoverAmount` called at lines 82, 106 |
| `components/dashboard/overview/overview-chart.tsx` | selectedMonth highlight | Cell fillOpacity on Entrate and Uscite Bars | VERIFIED | Both Bars have Cell arrays at lines 129-136 (Entrate) and 158-165 (Uscite); both use `fillOpacity={i === selectedMonth ? 1 : 0.4}` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `OverviewMoversPanel` | `movers: MonthOverMonthChange[]` | `initialMovers` from server-side prefetch (`page.tsx:58`) via `getMonthOverMonthCategoryChanges`; updated via `fetchMovers` action on bar click | DAL queries `lib/dal/overview.ts:173` — real DB query via `cache()` wrapper | FLOWING |
| `OverviewMoversSection` | `selectedMonth`, `movers`, `isPending` | `useState(defaultMonthIndex)` — derives from real chart data; `fetchMovers` call on change | `defaultMonthIndex` derived from `OverviewChartPoint[]` data from `getOverviewChart(year)` | FLOWING |
| `OverviewChart` | `selectedMonth: number` prop | Controlled from `OverviewMoversSection` — single source of truth | Same as above | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 15 formatter tests pass | `npx vitest run tests/overview-movers.test.tsx` | "PASS (15) FAIL (0)" | PASS |
| `lib/actions/overview.ts` has `'use server'` on line 1 | `awk 'NR==1'` | `'use server'` | PASS |
| Both Bars call `onMonthSelect` | `grep -c "onClick=(.*index.*) => onMonthSelect(index)"` | 2 occurrences | PASS |
| Both Cell arrays have fillOpacity highlight | `grep -n "fillOpacity=.*selectedMonth"` (lines 133, 162) | 2 occurrences | PASS |
| No internal `setSelectedMonth` in chart | `grep -c "setSelectedMonth"` | 0 | PASS |
| `verifySession` before DAL in action | line 20 before line 35 | Confirmed | PASS |
| `Number.isInteger` bounds in action | `grep -c "Number.isInteger"` | 2 | PASS |
| No `revalidate` in action | `grep -c "revalidate"` | 0 | PASS |
| `Object.values(p.out)` in deriveDefaultMonthIndex | `grep -n "Object.values"` | Line 38 | PASS |
| No `data.length - 1` naive last index | `grep -c "data.length - 1"` | 0 | PASS |
| Empty section guards in panel | `grep -n "increases.length > 0 \|\| savings.length > 0"` | Lines 69, 93 | PASS |
| Empty state copy present | `grep -n "Nessuna variazione"` | Line 62 | PASS |
| Section labels present | "Dove hai speso di più", "Dove hai risparmiato" | Lines 72, 96 | PASS |
| Panel is presentational (no state/fetch) | `grep -c "useState\|useTransition\|fetchMovers"` | 0 | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MOVE-01 | 45-02 | User can click a month's bar to see movers for that month | SATISFIED | `onMonthSelect` on both Bars; `handleMonthSelect` in section; `fetchMovers` on transition |
| MOVE-02 | 45-02 | Movers split into increases/savings; empty section hidden | SATISFIED | `splitMovers` in panel; `increases.length > 0` and `savings.length > 0` guards |
| MOVE-03 | 45-01 | Humanized sentences, "spesa nuova" for new, no percentages | SATISFIED | `formatMoverAmount` + table layout; no `%`; "spesa nuova" at line 49 of format module |
| MOVE-04 | 45-02 | Defaults to last month with data, that month highlighted | SATISFIED | `deriveDefaultMonthIndex` + `defaultMonthIndex` prop chain; chart `fillOpacity` |
| MOVE-05 | 45-02 | First month shows empty state | SATISFIED | `movers.length === 0` guard in panel at line 59 |

**Note:** REQUIREMENTS.md traceability table still shows all five MOVE requirements as "Pending" — not updated to "Complete". This is a housekeeping gap (no code impact).

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/dashboard/overview/overview-movers-format.ts` | 31-38 | Orphaned JSDoc block — `splitMovers` JSDoc sits before `formatMoverAmount`, misleading IDE tooling (WR-03 from code review) | Info | IDE hover shows wrong doc for `splitMovers` — no behavioral impact |
| `components/dashboard/overview/overview-movers-section.tsx` | 33 | Stale movers on `fetchMovers` error: `if (!result.error) { setMovers(...) }` silently keeps old month's data when fetch fails (WR-01 from code review) | Warning | Panel heading says new month but rows show previous month's data on network error |
| `components/dashboard/overview/overview-movers-panel.tsx` | 28 | Unused `data: OverviewChartPoint[]` prop accepted but never read; dead weight (WR-02 from code review) | Warning | No behavioral impact; dead import |
| `tests/overview-movers.test.tsx` | — | `formatMoverAmount` is the actual render path but has zero test coverage; `formatMoverLine` is tested but never called in UI components (IN-02 from code review) | Warning | Test coverage gap on the rendered code path |
| `lib/dal/overview.ts` | 258 | `isNew` detection uses `prevAmount === '0.00'` string equality; DB can return `"0"` for COALESCE fallback, causing missed `isNew` classification (CR-01 from code review) — **this is a Phase 42 DAL file not modified in Phase 45** | Info for Phase 45 | Wrong `isNew` classification possible; "spesa nuova" may not appear when it should |

**Debt marker gate:** No TBD, FIXME, or XXX markers found in any Phase 45 files. Gate passes.

---

### Implementation Deviation: formatMoverLine vs formatMoverAmount

The plan specified `formatMoverLine` (producing `{name} · €X in più` as a single sentence string) should be used in the panel. The actual implementation evolved to a two-column table layout where:
- `m.name` renders in a left-side `<span>`
- `formatMoverAmount(m)` renders in a right-side `<span>` (producing `€X in più` / `€X in meno` / `€X spesa nuova`)

This is a design evolution visible in the panel's JSDoc comment ("Two-column table layout: increases left, savings right"). The MOVE-03 requirement intent is met: human-readable presentation, "spesa nuova" for new spend, no percentages, no arrows. The 45-03 SUMMARY records human verification passed MOVE-03. `formatMoverLine` is exported and fully unit-tested but is not the active render path.

No override is required — the deviation satisfies the requirement intent and was accepted during the human verification checkpoint in Plan 03.

---

### Human Verification Required

The automated build, test, and language gates passed (880 tests, clean build per 45-03-SUMMARY). The 45-03 plan included a mandatory human verification checkpoint (task 2) which the SUMMARY claims passed. The following items require human confirmation in a running browser to independently confirm the SUMMARY claim:

### 1. Bar Click — Highlight + Panel Update (MOVE-01)

**Test:** Open `/dashboard/overview`, pick a year with data, click a different month's bar (either the green Entrate or red Uscite bar)
**Expected:** That month's two bars jump to full opacity; all other months' bars dim to ~40%; the panel heading and rows update to the clicked month; brief spinner inside the panel body (not full-page) during fetch
**Why human:** fillOpacity and useTransition panel update are visual/interactive behaviors that grep cannot confirm

### 2. Default Month on Initial Load (MOVE-04)

**Test:** Load `/dashboard/overview` for a year with several months of data; note which month's bars are at full opacity; check the panel heading
**Expected:** The highlighted month is the LAST month that actually has transactions — not necessarily December; the panel is already populated on first paint
**Why human:** `deriveDefaultMonthIndex` logic verified in code; correct real-data behavior requires the app running with actual transactions

### 3. Empty Section Hiding (MOVE-02)

**Test:** Navigate to a month where all movers are increases (or all are savings)
**Expected:** Only the non-empty section renders; the empty section is absent from the DOM (not present and empty — completely absent)
**Why human:** Conditional rendering verified by grep; confirming it triggers correctly requires real one-sided mover data

### 4. Empty State for First Month (MOVE-05)

**Test:** Click the leftmost available month bar
**Expected:** Panel shows "Nessuna variazione significativa — mese di partenza o nessuna spesa sopra €15." with no mover rows
**Why human:** Code path verified; behavior with actual first-month data needs browser confirmation

### 5. URL Unchanged by Bar Clicks

**Test:** Click several different month bars and observe the browser address bar
**Expected:** The `?year=` param never changes; month selection is entirely ephemeral client state
**Why human:** No `router.push`/`revalidatePath` in code — confirmed; browser-level URL immutability best confirmed manually

---

### Gaps Summary

No blocking gaps identified. All 5 MOVE requirements have code-level wiring verified. The phase goal is achievable — the drill-down is built and wired end-to-end.

Non-blocking items for follow-up:
- **REQUIREMENTS.md traceability** not updated: MOVE-01 through MOVE-05 still show "Pending" — housekeeping, no code impact
- **`formatMoverAmount` test coverage gap** (IN-02): the actual render path has no unit tests; `formatMoverLine` is tested but unused in UI
- **Stale movers on error** (WR-01): silent inconsistency when `fetchMovers` returns an error; panel heading and rows can disagree
- **DAL `isNew` string equality** (CR-01, Phase 42 file): `prevAmount === '0.00'` can miss `"0"` from DB; may cause incorrect `isNew` classification in edge cases

---

_Verified: 2026-06-09_
_Verifier: Claude (gsd-verifier)_
