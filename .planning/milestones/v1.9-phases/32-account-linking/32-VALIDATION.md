---
phase: 32
slug: account-linking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 (unit) + Playwright (E2E specs) |
| **Config file** | `vitest.config.ts` (unit: `tests/**/*.test.ts(x)`), `playwright.config.ts` (E2E: `tests/**/*.spec.ts`) |
| **Quick run command** | `yarn test` |
| **Full suite command** | `yarn test && yarn test:e2e` |
| **Estimated runtime** | ~30 seconds (unit), ~2 min (full) |

---

## Sampling Rate

- **After every task commit:** Run `yarn test`
- **After every plan wave:** Run `yarn test && yarn test:e2e`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds (unit)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 32-W0-01 | Wave 0 | 0 | LINK-03, LINK-04 | — | N/A | unit | `yarn test tests/connected-accounts-card.test.tsx` | ❌ W0 | ⬜ pending |
| 32-W0-02 | Wave 0 | 0 | LINK-01..04 | — | N/A | E2E | `yarn test:e2e --grep "LINK"` | ❌ W0 | ⬜ pending |
| 32-W0-03 | Wave 0 | 0 | LINK-01 | — | N/A | E2E | `yarn test:e2e` | existing | ⬜ pending |
| 32-01-01 | 01 | 1 | LINK-01 | T-32-01 | Settings hub routes protected by session | E2E | `yarn test:e2e --grep "LINK-01"` | ❌ W0 | ⬜ pending |
| 32-02-01 | 02 | 1 | LINK-02 | T-32-02 | /settings/profile accessible only to authenticated users | E2E | `yarn test:e2e --grep "LINK-02"` | ❌ W0 | ⬜ pending |
| 32-03-01 | 03 | 2 | LINK-04 | T-32-03 | Unlink disabled when last method remains | unit | `yarn test tests/connected-accounts-card.test.tsx` | ❌ W0 | ⬜ pending |
| 32-04-01 | 04 | 2 | LINK-03 | T-32-04 | Unlink confirmation prevents accidental removal | unit | `yarn test tests/connected-accounts-card.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/connected-accounts-card.test.tsx` — stubs for LINK-03, LINK-04 component rendering and unlink safety
- [ ] `tests/account-linking.spec.ts` — E2E stubs for LINK-01..04 navigation (with test.fixme for live OAuth flows)
- [ ] Update `tests/profile.spec.ts` — change route expectations from `/profile` to `/settings/profile`, update PROF-04 topbar nav assertion

*Existing vitest and Playwright infrastructure covers all other cases — no new config needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live OAuth link flow (Google) | LINK-02 | Requires live OAuth provider in dev | `test.fixme` stub in account-linking.spec.ts |
| Live OAuth link flow (GitHub) | LINK-02 | Requires live OAuth provider in dev | `test.fixme` stub in account-linking.spec.ts |
| Live unlink flow after OAuth link | LINK-03 | Requires prior live link state | `test.fixme` stub in account-linking.spec.ts |
| Email mismatch error display | LINK-02 | Requires live OAuth with mismatched account | Manual: sign in with different-email provider, verify Italian error message |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
