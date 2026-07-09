---
quick_id: 260709-gfz
description: Persist dashboard filters (chart chips + year) per-tab
date: 2026-07-09
status: complete
---

# Quick Task 260709-gfz — Summary

## Goal

Remember the dashboard Overview filters within the session, like the tables do:
the **year** selector and the **Entrate/Uscite/Accantonamento chip filters** on the chart.
Locked decision: `sessionStorage` (per-tab), matching the table filter layer — not
localStorage.

## What changed

- **`components/dashboard/overview/overview-persistence.ts`** (new) — pure,
  storage-injected helpers: `readExcludedChips`/`writeExcludedChips` (store the *excluded*
  chip keys per group; default all-on ⇒ usually empty), `readSavedYear`/`saveYear`, plus a
  local `safeSessionStorage`. Unknown/forged keys are validated out; every function
  degrades silently when storage is unavailable.
- **`overview-chart.tsx`** — chips stay chart-local (never in the URL — they filter
  already-fetched data client-side), but the excluded selection is remembered. State keeps
  the all-on default for **hydration parity**; a mount effect applies the persisted
  selection post-hydration; writes happen only in the toggle/reset handlers, so the restore
  effect never races with a write.
- **`overview-header.tsx`** — `saveYear` on year change; a bare-mount effect restores the
  last-selected year via `router.replace`, guarded to a year that still has data
  (`years.includes(saved)`) so a stale year never overrides the server default. URL stays
  the source of truth.

## Why two mechanisms

Year is server-driven (each year refetches) → URL + restore, mirroring the table layer.
Chips are pure client view-state → routing them through the URL would refetch identical
server data on every toggle, so they persist directly to sessionStorage instead. The
existing Suspense boundary + `startTransition` keep current content during the year-restore
swap (no skeleton flash).

## Verification

- `npx vitest run` on `overview-persistence` (new), `overview-interactions`,
  `overview-movers`, `step-2-overview`, `dashboard-filters` — **all green** (46 + 60).
- `npx tsc --noEmit` — no new errors in touched files.
- `node scripts/check-code-language.mjs` — clean.

### Verification gap (honest)

The repo's Vitest environment is **node-only** (no jsdom); `.tsx` tests use
`renderToStaticMarkup`, so `useEffect` does not run — the mount-restore wiring cannot be
unit-tested without introducing jsdom (a suite-wide config change, out of scope for a quick
task). The **pure persistence logic is fully covered**; the live browser round-trip
(toggle chips → navigate away → return; pick a year → return) was **not driven** in this
session (needs the running app + auth + seeded data). Recommend a quick manual/preview
check, or drive it via `/run`.

## Commits

- `c0d3447` feat: sessionStorage helpers for overview chips + year
- `66d76b3` feat: persist overview chart chips across the session
- `8c8ed8a` feat: restore last-selected year on bare dashboard mount

## Out of scope

- No URL contract change for chips (they stay out of the URL, per D-09) — only persistence.
- No localStorage (session scope, locked).
- No skeleton-gate for the year restore.
- Only the Overview route; category sub-pages untouched.
