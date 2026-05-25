---
phase: 30
slug: oauth-config
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `yarn test` |
| **Full suite command** | `yarn test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `yarn test`
- **After every plan wave:** Run `yarn test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 1 | REG-01 | — | Deleted registration module leaves no imports | unit | `yarn test && grep -r "registration" lib/ app/ --include="*.ts" \| wc -l` | ✅ | ⬜ pending |
| 30-01-02 | 01 | 1 | REG-01 | — | signUpAction proceeds without registration guard | unit | `yarn test` | ✅ | ⬜ pending |
| 30-01-03 | 01 | 1 | REG-01 | — | Route handler simplified to pure toNextJsHandler delegation | unit | `yarn test` | ✅ | ⬜ pending |
| 30-02-01 | 02 | 1 | ENV-01, ENV-02 | — | socialProviders absent when env vars unset | unit | `yarn tsc --noEmit && yarn test` | ✅ | ⬜ pending |
| 30-02-02 | 02 | 1 | ENV-01, ENV-02, ENV-03 | — | .env.example contains OAuth vars, no REGISTRATION_ENABLED | manual | `grep "GOOGLE_CLIENT_ID\|GITHUB_CLIENT_ID" .env.example` | ✅ | ⬜ pending |
| 30-02-03 | 02 | 1 | ENV-03 | — | Runbook documents callback URL format and 4 OAuth vars | manual | `grep "callback/google\|callback/github" docs/deploy/vercel-supabase-r2.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Vitest is already installed and configured. No new test infrastructure needed.

*Phase 30 deletes test files (net reduction); no new test files to create as Wave 0 stubs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OAuth login completes with real Google credentials | ENV-01 | Requires live OAuth app registration and browser flow | Set GOOGLE_CLIENT_ID/SECRET in .env.local, run `yarn dev`, navigate to `/login`, click "Continue with Google", complete OAuth flow, land on `/dashboard` |
| OAuth login completes with real GitHub credentials | ENV-02 | Requires live OAuth app registration and browser flow | Set GITHUB_CLIENT_ID/SECRET in .env.local, run `yarn dev`, navigate to `/login`, click "Continue with GitHub", complete OAuth flow, land on `/dashboard` |
| Adding env vars activates provider with no code change | ENV-01, ENV-02 | Runtime behavior — requires starting Next.js and calling the auth API | Start dev server, call `POST /api/auth/sign-in/social` with `{ provider: "google" }` — should return a redirect URL; without env vars same call should 400 or return no redirect |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
