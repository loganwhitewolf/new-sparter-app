---
phase: 31
slug: oauth-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 + Playwright (e2e) |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `yarn test tests/oauth-ui.test.tsx` |
| **Full suite command** | `yarn test` |
| **Estimated runtime** | ~10 seconds (unit only) |

---

## Sampling Rate

- **After every task commit:** Run `yarn test tests/oauth-ui.test.tsx`
- **After every plan wave:** Run `yarn test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 0 | OAUTH-05 | T-XSS | searchParams.error displayed via lookup, not raw | unit | `yarn test tests/oauth-ui.test.tsx` | ❌ W0 | ⬜ pending |
| 31-01-02 | 01 | 0 | OAUTH-05 | — | activeProviders=[] renders no social section | unit | `yarn test tests/oauth-ui.test.tsx` | ❌ W0 | ⬜ pending |
| 31-01-03 | 01 | 1 | OAUTH-05 | — | Google button renders when GOOGLE_CLIENT_ID set | unit | `yarn test tests/oauth-ui.test.tsx` | ❌ W0 | ⬜ pending |
| 31-01-04 | 01 | 1 | OAUTH-05 | — | GitHub button renders when GITHUB_CLIENT_ID set | unit | `yarn test tests/oauth-ui.test.tsx` | ❌ W0 | ⬜ pending |
| 31-01-05 | 01 | 1 | D-07/D-08 | T-XSS | Known error codes map to Italian strings | unit | `yarn test tests/oauth-ui.test.tsx` | ❌ W0 | ⬜ pending |
| 31-01-06 | 01 | 1 | OAUTH-01 | — | Existing Google user signs in | e2e (manual) | manual — real provider needed | ❌ W0 stub | ⬜ pending |
| 31-01-07 | 01 | 1 | OAUTH-02 | — | New Google user gets account created | e2e (manual) | manual — real provider needed | ❌ W0 stub | ⬜ pending |
| 31-01-08 | 01 | 1 | OAUTH-03 | — | Existing GitHub user signs in | e2e (manual) | manual — real provider needed | ❌ W0 stub | ⬜ pending |
| 31-01-09 | 01 | 1 | OAUTH-04 | — | New GitHub user gets account created | e2e (manual) | manual — real provider needed | ❌ W0 stub | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/oauth-ui.test.tsx` — stubs + unit tests for OAUTH-05 (conditional rendering) and D-07/D-08 (error message mapping)
- [ ] `tests/auth.spec.ts` — add `test.fixme()` stubs for OAUTH-01 through OAUTH-04 following existing pattern
- [ ] Verify `@testing-library/react` is installed (used in `tests/category-combobox.test.tsx`)

*Existing Vitest + React Testing Library infrastructure covers all unit test requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Existing Google user sign-in | OAUTH-01 | Requires real Google OAuth credentials and live callback | Set GOOGLE_CLIENT_ID+SECRET in .env.local, run dev server, click "Continua con Google", sign in with existing Google account, verify redirect to /dashboard |
| New Google user account creation | OAUTH-02 | Requires Google credentials + new account | Same setup, use Google account not previously registered, verify account created in DB |
| Existing GitHub user sign-in | OAUTH-03 | Requires real GitHub OAuth credentials | Set GITHUB_CLIENT_ID+SECRET, click "Continua con GitHub", sign in with existing GitHub account |
| New GitHub user account creation | OAUTH-04 | Requires GitHub credentials + new account | Same setup, use GitHub account not previously registered |
| OAuth error display (callback error) | D-07 | Requires triggering real OAuth error | Revoke app access in Google/GitHub settings, attempt sign-in, verify Italian error message appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
