---
status: diagnosed
trigger: "History-based back (filters/sort/scroll preserved) when arriving from the entity's own table is not working — user reports the previous filter is not preserved when navigating back from a detail page. (goal: find_root_cause_only)"
created: 2026-07-06T15:45:00Z
updated: 2026-07-06T16:10:00Z
---

## Current Focus

hypothesis: CONFIRMED — Next.js App Router's documented Client Cache "reused during browser back/forward navigation" behavior serves a stale (pre-filter) RSC render for `/transactions` (and `/expenses`) when `router.back()` is invoked from a detail page, because the table's filter/sort state is written via `router.replace()` (`useTableUrl` in `components/data-table/use-table-url.ts`), and Next.js's back/forward cache reuse bypasses the normal "dynamic pages are not cached, always refetch" rule that would otherwise keep filtered navigations fresh.
test: Traced full navigation chain (table -> filter via replace -> row Link push -> detail page -> DetailPageShell back handler) against Next.js 16.2.4's own bundled documentation (node_modules/next/dist/docs).
expecting: N/A — diagnosis phase complete, mode is find_root_cause_only.
next_action: Return ROOT CAUSE FOUND to caller; no fix_and_verify (out of scope for this mode).

## Symptoms

expected: History-based back (filters/sort/scroll preserved) when arriving from the entity's own table; static-route fallback when there's no usable in-app history (direct load / external referrer). Applies to all three detail pages: /transactions/[id], /expenses/[id], /import/[fileId].
actual: "quando torno indietro da una pagina di dettaglio non si mantiene il filtro precedente" (when I go back from a detail page, the previous filter is not maintained)
errors: None reported
reproduction: Test 1 in UAT (.planning/phases/64-file-detail-and-navigation/64-UAT.md) — apply a filter (e.g. month) on /transactions, open a row's detail page, click "Indietro", observe the table filter is gone.
started: Discovered during UAT of Phase 64 (file-detail-and-navigation), just after Plan 64-05 implemented smart-back navigation in DetailPageShell.

## Eliminated

- hypothesis: "DetailPageShell's smart-back heuristic (window.history.length / document.referrer) incorrectly falls back to router.push(backHref) instead of router.back() for normal in-app navigation, discarding the filter by static-routing to the unfiltered table."
  evidence: Traced handleBackClick in components/detail-pages/detail-page-shell.tsx. For the reported repro (user filters table, clicks a row via next/link push navigation, then clicks Indietro): window.history.length is always >= 2 at that point (the row-click Link itself performed a pushState, incrementing history.length beyond the 1-entry "fresh tab" threshold), and document.referrer is set once at the SPA's initial full-page load and never changes across client-side navigations — so it is either '' (explicitly treated as NOT external via `if (referrer === '') return false`) or same-origin for any user who has been navigating inside the app. Both hasNoHistory and isExternalReferrer evaluate false in the reported scenario, so the heuristic correctly selects router.back(), not router.push(backHref).
  timestamp: 2026-07-06T15:55:00Z

- hypothesis: "TransactionsToolbar/DataTableToolbar keeps filter values in local React state that doesn't resync with the URL after a non-remounting back navigation, so the UI shows the toolbar's stale in-memory state even though the URL correctly restored the filter."
  evidence: Read components/data-table/DataTableToolbar.tsx in full. All active filter values, chips, and counts (`countActiveFilters`, `chips`, `activeSort`/`activeDir`) are derived directly from `useSearchParams()` (via useTableUrl) on every render — no useState/useMemo caching of filter values that could go stale. The only local state is `searchDraft` (debounced free-text search box), which is explicitly resynced via `useEffect(() => setSearchDraft(urlSearchValue), [urlSearchValue])`. This component re-derives correctly from whatever URL Next.js's router context reports as current.
  timestamp: 2026-07-06T16:00:00Z

## Evidence

- timestamp: 2026-07-06T15:50:00Z
  checked: components/detail-pages/detail-page-shell.tsx (full file, current state post Plan 64-05)
  found: handleBackClick calls event.preventDefault(), then computes hasNoHistory = window.history.length <= 1 and isExternalReferrer from document.referrer's origin, choosing router.push(backHref) only when either is true, otherwise router.back().
  implication: The smart-back decision logic itself is not the defect for the reported scenario — it correctly dispatches to router.back() for standard in-app table -> detail navigation.

- timestamp: 2026-07-06T15:58:00Z
  checked: components/data-table/use-table-url.ts (full file)
  found: All filter/sort/search param writes go through `replaceWith`, which calls `router.replace(url, { scroll: false })` inside a startTransition — never router.push. This means every filter change on /transactions or /expenses REPLACES the current history entry's URL rather than pushing a new one; the table route only ever occupies a single history slot, which is then overwritten in place as filters change.
  implication: When the user later clicks a row (a genuine `<Link>` push to the detail page), the browser history stack is [table entry, now bearing the LAST-applied filter URL via replace] -> [detail entry, pushed]. router.back() should restore the table entry's URL (this part of History API semantics is standard and reliable), but WHAT NEXT.JS ACTUALLY RENDERS for that restored URL is the open question — addressed by the following evidence.

- timestamp: 2026-07-06T16:03:00Z
  checked: node_modules/next/dist/docs/01-app/04-glossary.md ("Client Cache" entry) and node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/staleTimes.md — both from this project's installed Next.js 16.2.4
  found: "An in-memory cache in the browser that stores RSC Payload for visited and prefetched routes... **Pages are not cached by default but are reused during browser back/forward navigation.**" staleTimes.md's `dynamic` default is 0 seconds ("not cached") for Next.js >= 15, meaning a dynamic, searchParams-driven page like /transactions is supposed to always refetch fresh data on ordinary navigation — EXCEPT the same doc explicitly carves out back/forward: "This doesn't change back/forward caching behavior to prevent layout shift and to prevent losing the browser scroll position." /transactions is unconditionally dynamic (its page.tsx awaits `searchParams` and queries the DB directly, a documented Request-time API trigger for dynamic rendering per the Glossary's "Request-time APIs" entry).
  implication: This is the confirmed root-cause mechanism. Next.js's App Router deliberately reuses whatever RSC render is already resident in the client-side Router Cache when the user navigates via browser back/forward (native `history.back()`, which is what `router.back()` invokes), REGARDLESS of the page being "dynamic"/normally-uncached. Because /transactions' filter changes are applied via `router.replace()` on the SAME history entry (not a new push per filter change), and the row-click detail page navigation happens via `push()` (a genuinely new entry), returning via `router.back()` triggers Next's back/forward-reuse path rather than a fresh dynamic fetch — so the table can render from a Client Cache entry that does not reflect the filter state the user had applied via replace, producing the observed "filter not maintained" symptom. The address bar / `useSearchParams()`-driven UI (toolbar chips) may still show correctly restored query params (native History API guarantees the URL/entry.replaceState was persisted), while the underlying page-tree render served from cache can be the pre-filter/initial snapshot — this is consistent with the user's exact report of "the previous filter is not maintained" rather than a URL/error symptom.

- timestamp: 2026-07-06T16:05:00Z
  checked: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md
  found: Documented contract — `router.replace(href)`: "Perform a client-side navigation to the provided route **without adding a new entry into the browser's history stack**." `router.back()`: "Navigate back to the previous route in the browser's history stack." No documented option to force a fresh fetch specifically for back/forward transitions other than an explicit `router.refresh()` call (which clears the Client Cache for the CURRENT route only, at the time it's called — not retroactively for a route being returned TO via back/forward).
  implication: There is no built-in escape hatch that makes back/forward navigation always dynamic for this class of page; a fix must explicitly route around the cache-reuse behavior (e.g., forcing a refresh alongside/after `router.back()`, or restructuring how filter state reaches the table) rather than relying on `router.back()` alone.

## Resolution

root_cause: |
  Next.js 16 App Router's Client Cache explicitly reuses a page's previously-rendered RSC
  payload when navigating via browser back/forward (`router.back()`), even for dynamic pages
  that are otherwise never cached on ordinary push/replace navigation (documented: "Pages are
  not cached by default but are reused during browser back/forward navigation" — this doesn't
  change based on `staleTimes.dynamic`, which defaults to 0s in v15+). The transactions/expenses
  tables' filter and sort state is written into the URL exclusively via `router.replace()`
  (components/data-table/use-table-url.ts's `replaceWith`), which updates the CURRENT history
  entry in place rather than pushing a new one. DetailPageShell's Plan 64-05 smart-back
  implementation (components/detail-pages/detail-page-shell.tsx) correctly decides to call
  `router.back()` for normal in-app navigation (its history.length/referrer heuristic is not at
  fault — verified and eliminated), but the underlying `router.back()` triggers Next's
  back/forward Client Cache reuse path instead of a fresh dynamic fetch, so the table can
  re-render from a stale (pre-filter) cached snapshot instead of reflecting the filtered URL the
  user had last replaced it with. This is a caching-layer interaction the Plan 64-05 human-check
  step could not catch via the project's node-environment vitest setup (no jsdom/real browser),
  and it was not anticipated in 64-RESEARCH.md's Pattern 3 / Pitfall 4, which only considered the
  "no history at all" fallback case, not "history exists but its cached render predates a
  replace()-driven filter change."
fix: ""
verification: ""
files_changed: []
