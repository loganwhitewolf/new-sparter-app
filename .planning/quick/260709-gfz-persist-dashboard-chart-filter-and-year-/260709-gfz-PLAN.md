# Quick Task 260709-gfz: Persist dashboard filters (chart chips + year)

## Goal

Remember the user's dashboard overview filters within the session, like the tables do:
- the **year** selector (`?year=` in the URL, today not restored on return), and
- the **Entrate/Uscite/Accantonamento chip filters** on the overview chart (today pure
  chart-local `useState`, reset on every navigation — see `overview-chart.tsx` "D-09:
  chip state is chart-local only, no URL, no localStorage").

**Decision (locked):** `sessionStorage`, per-tab — same durability as the table filters
(ADR 0009/0010). Not localStorage.

## Design

Two concerns, each with the mechanism that fits it:

- **Year** — stays URL-driven (server refetches per year). Add: save the selected year to
  `sessionStorage` on change; on a **bare** mount (no `?year` in the URL) restore it via
  `router.replace`, guarded so we never restore a year that no longer has data. Mirrors
  the table restore layer. The Suspense boundary + `startTransition` keep current content
  during the restore swap (no skeleton flash).
- **Chips** — stay client-only (they filter already-fetched data via `deriveFilteredBarRow`;
  routing them through the server would refetch identical data on every toggle — wrong).
  Persist to `sessionStorage` directly. **Hydration-safe:** state initializes to the
  SSR default (all-on), a mount effect applies the persisted *excluded* sets, and each
  toggle/reset writes the excluded sets. No functional-updater/effect-write race: restore
  effect only reads; writes happen only in the user-action handlers.

Storage stores **excluded** keys (default all-on ⇒ usually empty ⇒ clean).

## Tasks

### 1. New pure helper `components/dashboard/overview/overview-persistence.ts`
- `safeSessionStorage()` (tiny local copy — keep the dashboard decoupled from
  `components/data-table`; ~6 lines).
- Chip keys: `CHIP_STORAGE_KEY = 'dashboard-overview:chart-chips'`.
  - `type ExcludedChips = { income: IncomeKey[]; out: OutKey[]; allocation: AllocationKey[] }`
  - `readExcludedChips(storage): ExcludedChips | null` — JSON.parse, drop unknown keys
    (validate against INCOME_KEYS/OUT_KEYS/ALLOCATION_KEYS), tolerate malformed/absent → null.
  - `writeExcludedChips(storage, excluded)` — JSON.stringify, silent on throw.
- Year keys: `YEAR_STORAGE_KEY = 'dashboard-overview:year'`.
  - `readSavedYear(storage): string | null`, `saveYear(storage, year)` — silent on throw.
- All functions pure over an injected `Storage | null` so they're unit-testable.

### 2. `overview-chart.tsx` — chip persistence
- Keep `useState` defaults all-on (SSR parity).
- Add a mount effect (`[]`): `readExcludedChips` → if present, set the three included sets
  to `ALL minus excluded`.
- In `handleToggleIncome/Out/Allocation` and `handleReset`: after computing the next
  state, call a local `persist(income, out, allocation)` that writes the excluded arrays
  (derived from the current-render sets + the one that changed). Reset writes empty excluded.

### 3. `overview-header.tsx` — year persistence
- In `update(next)`: `saveYear(safeSessionStorage(), next)` before/with the `router.replace`.
- Add a mount effect (`[]`): if `!searchParams.has('year')`, read `readSavedYear`; if it is
  present **and** `years.includes(saved)`, `router.replace(\`${pathname}?year=${saved}\`,
  { scroll: false })`. Guard prevents restoring a stale year with no data.

### 4. Tests `tests/overview-persistence.test.ts`
- `readExcludedChips`: round-trips a written value; returns null on malformed JSON / absent
  key / null storage; filters unknown keys out of each group; empty-excluded round-trip.
- `writeExcludedChips`/`saveYear`: silent no-op on a throwing `setItem` and on null storage.
- `readSavedYear`: returns saved value; null when absent.
- (Behavioral wiring is covered by the pure helpers + existing overview-interactions
  derivation tests; a fake `Storage` object drives these unit tests.)

## Verify
- `npx vitest run tests/overview-persistence.test.ts` + existing `overview-interactions`
  green.
- `npx tsc --noEmit` — no new errors in touched files.
- `node scripts/check-code-language.mjs` — clean (dev strings English; only Italian is the
  existing product copy, untouched).

## Out of scope
- No change to the URL contract for chips (they stay out of the URL, per D-09) — only
  persistence is added.
- No localStorage (session scope, locked).
- No skeleton-gate for the year restore (Suspense + transition already avoid a skeleton
  flash; the content swap default→saved is accepted, matching the table restore approach).
- No changes to category sub-pages / other dashboard routes.
