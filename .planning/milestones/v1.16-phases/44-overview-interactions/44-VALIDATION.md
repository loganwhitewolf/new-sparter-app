---
phase: 44
slug: overview-interactions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-08
---

# Phase 44 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 and Playwright 1.60.0 |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `yarn test tests/overview-interactions.test.tsx` |
| **Full suite command** | `yarn test && yarn check:language && yarn build` |
| **Estimated runtime** | ~30-90 seconds for focused tests, longer for full suite/build |

---

## Sampling Rate

- **After every task commit:** Run `yarn test tests/overview-interactions.test.tsx`
- **After touching comments, tests, docs, or developer-facing strings:** Run `yarn check:language`
- **After every plan wave:** Run `yarn test && yarn check:language`
- **Before `$gsd-verify-work`:** Run `yarn build` after focused tests and language checks
- **Max feedback latency:** 90 seconds for focused phase feedback

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 44-01-01 | 01 | 1 | NUDGE-01 | T-44-01 | Count source remains display-only and user-scoped through existing DAL | component/unit | `yarn test tests/overview-interactions.test.tsx -t nudge` | No - Wave 0 | pending |
| 44-01-02 | 01 | 1 | NUDGE-02 | T-44-02 | CTA uses canonical `/transactions` filters only | component/unit | `yarn test tests/overview-interactions.test.tsx -t nudge` | No - Wave 0 | pending |
| 44-01-03 | 01 | 1 | NUDGE-03 | T-44-01 | localStorage controls only presentation, never authorization or DB state | unit | `yarn test tests/overview-interactions.test.tsx -t lastSeenCount` | No - Wave 0 | pending |
| 44-01-04 | 01 | 1 | NUDGE-04 | T-44-01 | Zero count suppresses presentation without changing server data | unit | `yarn test tests/overview-interactions.test.tsx -t nudge` | No - Wave 0 | pending |
| 44-02-01 | 02 | 1 | FILT-01 | T-44-03 | Filter state never changes KPI totals or server data | unit | `yarn test tests/overview-interactions.test.tsx -t income` | No - Wave 0 | pending |
| 44-02-02 | 02 | 1 | FILT-02 | T-44-03 | Filter state never changes KPI totals or server data | unit | `yarn test tests/overview-interactions.test.tsx -t expense` | No - Wave 0 | pending |
| 44-02-03 | 02 | 1 | FILT-03 | T-44-03 | KPI props remain independent from chart chip state | component/unit | `yarn test tests/overview-interactions.test.tsx -t KPI` | No - Wave 0 | pending |
| 44-03-01 | 03 | 1 | EDU-01 | T-44-04 | Education content is static React text, not HTML injection | component | `yarn test tests/overview-interactions.test.tsx -t education` | No - Wave 0 | pending |
| 44-03-02 | 03 | 1 | EDU-02 | T-44-04 | Tooltip definitions are static React text and have accessible triggers | component | `yarn test tests/overview-interactions.test.tsx -t tooltip` | No - Wave 0 | pending |

---

## Wave 0 Requirements

- [ ] `tests/overview-interactions.test.tsx` - focused tests for NUDGE-01..04, FILT-01..03, and EDU-01..02.
- [ ] Pure helper coverage for nudge visibility (`lastSeenCount`) and chart filter reduction before UI wiring.
- [ ] Static render coverage for nudge CTA/dismiss accessible labels and education triggers.
- [ ] Optional Playwright coverage only if an authenticated seeded overview fixture is reliable enough to verify browser localStorage behavior.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Popover/tooltip placement and visual density | EDU-01, EDU-02 | Radix portal content and final dashboard density are better judged in browser than static markup | Run the app, open `/dashboard/overview`, inspect Entrate/Uscite info triggers and chip tooltips at desktop and mobile widths. |
| Inline title-row nudge fit | NUDGE-01, NUDGE-02 | Title row wrapping and amber treatment are layout-sensitive | Seed or mock a year with uncategorized OUT expenses, open `/dashboard/overview?year=YYYY`, verify the nudge remains inline or wraps cleanly without overlapping the year selector. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify commands or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all missing references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90 seconds for focused phase tests
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 tests exist and pass

**Approval:** pending
