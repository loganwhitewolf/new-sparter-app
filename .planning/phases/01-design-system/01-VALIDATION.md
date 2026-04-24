---
phase: 1
slug: design-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (E2E smoke — no DB needed for Phase 1) |
| **Config file** | `playwright.config.ts` — Wave 0 installs |
| **Quick run command** | `npx playwright test tests/layout.spec.ts --project=chromium` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~10–15 seconds (2 page load checks, CSS assertions) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test tests/layout.spec.ts --project=chromium`
- **After every plan wave:** Run `npx playwright test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| DS-01-css-vars | 01 | 1 | DS-01 | — | N/A | smoke | `npx playwright test tests/design-system.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |
| DS-01-fonts | 01 | 1 | DS-01 | — | N/A | manual | Lighthouse CLS check | Manual | ⬜ pending |
| DS-02-components | 01 | 1 | DS-02 | — | N/A | smoke | `npx playwright test tests/design-system.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |
| DS-03-auth-layout | 01 | 1 | DS-03 | — | N/A | smoke | `npx playwright test tests/layout.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |
| DS-03-app-layout | 01 | 1 | DS-03 | — | N/A | smoke | `npx playwright test tests/layout.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |
| DS-03-mobile-nav | 01 | 1 | DS-03 | — | N/A | smoke | `npx playwright test tests/layout.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install Playwright: `npm install --save-dev @playwright/test && npx playwright install chromium`
- [ ] `playwright.config.ts` — baseURL `http://localhost:3000`, single chromium project, webServer `npm run dev`
- [ ] `tests/design-system.spec.ts` — checks CSS variable `--primary` present in `:root`, confirms `font-family` contains "Geist", confirms shadcn Button renders at `/login`
- [ ] `tests/layout.spec.ts` — checks `/login` has no `[data-sidebar]` element, `/dashboard` has sidebar visible on desktop viewport (1280×800), bottom nav `[data-bottom-nav]` visible on mobile (375×812) and hidden on desktop

*All Phase 1 test files must be created before any plan execution begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Geist font loads without CLS | DS-01 | Lighthouse metric — not automatable in Playwright without perf plugin | Run `npx lighthouse http://localhost:3000/login --only-categories=performance` after `npm run build && npm start`; confirm CLS < 0.1 |
| shadcn New York style visually applied (border-radius, shadows) | DS-02 | Visual appearance — snapshot would be brittle | Open `/login` in browser; confirm Button has 6–8px radius, Card has slight shadow, no sharp corners |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
