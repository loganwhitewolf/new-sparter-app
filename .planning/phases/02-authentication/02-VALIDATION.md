---
phase: 2
slug: authentication
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.59.1 |
| **Config file** | `playwright.config.ts` (exists) |
| **Quick run command** | `npx playwright test --project=chromium tests/auth.spec.ts` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~30 seconds (quick), ~60 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=chromium tests/auth.spec.ts`
- **After every plan wave:** Run `npx playwright test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-W0-01 | W0 | 0 | AUTH-01 | — | N/A | e2e stub | `npx playwright test tests/auth.spec.ts` | ❌ W0 | ⬜ pending |
| 2-W0-02 | W0 | 0 | DS-03 | — | N/A | e2e update | `npx playwright test tests/layout.spec.ts` | ✅ update | ⬜ pending |
| 2-01-01 | 01 | 1 | AUTH-01 | T-2-01 | Registration fails on weak password; error banner shown; email never leaked | e2e | `npx playwright test --project=chromium tests/auth.spec.ts::register` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | AUTH-01 | T-2-01 | Short password (< 8 chars) triggers Zod error, no DB write | e2e | `npx playwright test --project=chromium tests/auth.spec.ts::register-short-password` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | AUTH-01 | T-2-02 | Email-already-registered shows generic error (no enumeration) | e2e | `npx playwright test --project=chromium tests/auth.spec.ts::register-duplicate` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 2 | AUTH-02 | T-2-03 | Session cookie is HttpOnly; JS cannot read it | e2e | `npx playwright test --project=chromium tests/auth.spec.ts::login-session` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 2 | AUTH-02 | T-2-04 | Wrong credentials show generic error banner (no field-level detail) | e2e | `npx playwright test --project=chromium tests/auth.spec.ts::login-invalid` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 3 | AUTH-03 | T-2-05 | /dashboard unauthenticated → 302 redirect to /login | e2e | `npx playwright test --project=chromium tests/auth.spec.ts::redirect` | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 3 | AUTH-03 | T-2-06 | x-staging-key header bypasses auth; STAGING_KEY not set in prod | e2e | `npx playwright test --project=chromium tests/auth.spec.ts::staging-bypass` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/auth.spec.ts` — stubs for AUTH-01 (register flow), AUTH-02 (login + session), AUTH-03 (redirect + staging bypass)
- [ ] Update `tests/layout.spec.ts` — fix `/dashboard returns 200` test: add `x-staging-key` header or accept 302 redirect (DS-03 test will break once proxy.ts is wired)

*Note: Playwright is already installed (Phase 1). No additional framework install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Session persists after browser refresh | AUTH-02 | Playwright does not fully simulate multi-tab/restart; cookie persistence needs browser session check | Log in, close and reopen tab, navigate to /dashboard — should stay authenticated |
| Topbar avatar fallback shows first letter of email | AUTH-02 | Visual regression — email char at position 0 rendered as AvatarFallback | Log in, open topbar dropdown — avatar circle should show first letter of email, emerald background |
| STAGING_KEY absent in production env has no bypass | AUTH-03 | Requires prod-like env; cannot be Playwright-tested locally | Confirm Railway production service has no STAGING_KEY environment variable set |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
