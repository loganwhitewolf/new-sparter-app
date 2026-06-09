---
phase: 41
slug: collapsible-sidebar
status: validated
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-07
audited: 2026-06-07
---

# Phase 41 — Validation Strategy

> Retroactive Nyquist audit — State B reconstruction from PLAN/SUMMARY artifacts.
> All plans were executed with `tdd="false"`. Automated verification ran via build gates + grep checks
> at execution time. This audit adds dedicated unit tests for D-11, D-12, D-13, D-14 and maps
> all requirements to their coverage source.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.5 (unit/component) + Playwright (E2E) |
| **Config file** | `vitest.config.ts` / `playwright.config.ts` |
| **Quick run command** | `yarn test` |
| **Full suite command** | `yarn test && yarn playwright test` |
| **Estimated runtime** | ~3s (unit) / ~60s (E2E with staging key) |

---

## Sampling Rate

- **After every task commit:** Run `yarn test`
- **After every plan wave:** Run `yarn test && yarn build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~3 seconds (unit), ~60s (E2E)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 41-01-T1 | 01 | 1 | D-05, D-13, D-14 | unit | `yarn test tests/sidebar-provider.test.tsx` | ✅ green |
| 41-01-T2 | 01 | 1 | — (Tooltip infra) | build | `yarn tsc --noEmit` | ✅ green |
| 41-02-T1 | 02 | 2 | D-01, D-02, D-03, D-09 | E2E | `yarn playwright test tests/layout.spec.ts` | ✅ green |
| 41-02-T2 | 02 | 2 | D-04, D-06, D-07, D-08 | E2E | `yarn playwright test tests/layout.spec.ts tests/profile.spec.ts` | ✅ green |
| 41-03-T1 | 03 | 3 | D-10, D-11, D-12 | unit+E2E | `yarn test tests/settings-hub.test.tsx && yarn playwright test tests/layout.spec.ts` | ✅ green |
| 41-03-T2 | 03 | 3 | D-01 | unit | `yarn test tests/app-layout-guard.test.ts` | ✅ green |
| 41-03-T3 | 03 | 3 | (build gate) | build | `yarn build && yarn test` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Requirement Coverage Detail

| Req ID | Description | Coverage Source | Status |
|--------|-------------|-----------------|--------|
| D-01 | topbar.tsx deleted, no importer | `tests/app-layout-guard.test.ts` — no topbar mock; `yarn build` compilation | ✅ COVERED |
| D-02 | Sidebar hidden mobile / BottomNav visible | `tests/layout.spec.ts` — "bottom nav is visible on mobile" + "desktop sidebar visible" | ✅ COVERED |
| D-03 | Collapsed: icon-only + tooltips; Expanded: icon + label | Manual (see Manual-Only) | ⚠️ MANUAL |
| D-04 | Chevron toggle button | `tests/layout.spec.ts` — collapse test clicks 'Comprimi barra laterale' | ✅ COVERED |
| D-05 | localStorage key `sparter-sidebar-collapsed` | `tests/layout.spec.ts` (E2E) + `tests/sidebar-provider.test.tsx` | ✅ COVERED |
| D-06 | Toggle aria-label alternates expand/collapse | `tests/layout.spec.ts` — reload shows 'Espandi barra laterale' | ✅ COVERED |
| D-07 | User name + email in user control | Manual (see Manual-Only) | ⚠️ MANUAL |
| D-08 | Profilo link and Logout in dropdown | `tests/profile.spec.ts` PROF-04 (Profilo nav); Logout: manual | ✅ COVERED (Profilo) |
| D-09 | Active route highlighted | Manual (see Manual-Only) | ⚠️ MANUAL |
| D-10 | BottomNav Impostazioni → /settings | `tests/layout.spec.ts` — "mobile bottom nav has an Impostazioni link" | ✅ COVERED |
| D-11 | SettingsHub Aspetto section | `tests/settings-hub.test.tsx` — renders 'Aspetto' + Tema/Chiaro label | ✅ COVERED |
| D-12 | ThemeToggle reused unchanged | `tests/settings-hub.test.tsx` — ThemeToggle mock rendered; no new wrapper added | ✅ COVERED |
| D-13 | SidebarContext type `{collapsed, setCollapsed}` | `tests/sidebar-provider.test.tsx` — runtime shape check | ✅ COVERED |
| D-14 | SSR default collapsed=false | `tests/sidebar-provider.test.tsx` — renderToStaticMarkup initial state | ✅ COVERED |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No Wave 0 scaffolding needed — phase executed with `tdd="false"` and build gates as primary verification. Two new test files added retroactively:

- `tests/sidebar-provider.test.tsx` — D-13, D-14, context throw behavior
- `tests/settings-hub.test.tsx` — D-11, D-12

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Collapsed mode: icon-only nav + tooltip on hover | D-03 | Visual rendering requires browser interaction; tooltip visibility is ephemeral | Load /dashboard on desktop, collapse sidebar, hover a nav icon, verify tooltip appears |
| Expanded mode: icon + label side by side | D-03 | Visual rendering | Load /dashboard on desktop (default state), verify each nav item shows icon + text label |
| User name + email visible in sidebar user control | D-07 | Requires authenticated session with real user data | Log in, expand sidebar, verify name/email appear above avatar dropdown |
| Active route CSS highlight | D-09 | CSS class state tied to pathname; would need authenticated E2E + URL navigation | Navigate between routes, verify the current route's nav item has highlighted background |

---

## Validation Audit 2026-06-07

| Metric | Count |
|--------|-------|
| Requirements total | 14 |
| COVERED (automated) | 10 |
| MANUAL-only | 3 |
| PARTIAL → COVERED | 2 (D-13, D-14) |
| Tests added | 9 (across 2 files) |
| Gaps resolved | 4 |
| Escalated | 0 |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual-only justification
- [x] No sampling gap > 3 consecutive tasks without automated verify
- [x] MISSING gaps (D-11, D-12, D-13, D-14) resolved with new unit tests
- [x] No watch-mode flags
- [x] Feedback latency: ~3s (unit), ~60s (E2E)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-07
