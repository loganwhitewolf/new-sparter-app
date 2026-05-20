---
phase: "27"
plan: "04"
---

# T04: Documented the implemented REGISTRATION_ENABLED production toggle and verified the full registration guardrail slice.

**Documented the implemented REGISTRATION_ENABLED production toggle and verified the full registration guardrail slice.**

## What Happened

Updated `.env.example` to describe `REGISTRATION_ENABLED` as an implemented server-side guardrail: enabled by default, disabled only by explicit false-like values, requiring Vercel redeploy after env changes, and preserving existing-user login. Updated `docs/deploy/vercel-supabase-r2.md` so the Vercel runtime env table marks the variable as optional and implemented, non-public, server-enforced, and covering both server action signup and direct `/api/auth/sign-up/email` rejection. Added a concise registration toggle smoke/recovery section documenting disabled signup UI behavior, direct API 403 `registration_disabled`, preserved signin for existing users, server-side—not UI-only—enforcement, redeploy requirements, and accidental-disable recovery. During production build verification, TypeScript rejected the prior default parameter typing for `process.env`; fixed `lib/auth/registration.ts` with an explicit cast to the testable `RegistrationEnv` shape without changing runtime behavior or parser semantics.

## Verification

Ran the required slice verification command freshly: targeted Vitest registration tests, lint, language convention check, and production build. Vitest passed 3 files / 14 tests, including disabled signup action/API tests and preserved signin delegation. ESLint exited 0 with three existing warnings unrelated to this task. `yarn check:language` passed. `yarn build` completed successfully after the type-only env parser fix.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn vitest tests/registration-config.test.ts tests/auth-actions-registration.test.ts tests/auth-route-registration.test.ts` | 0 | ✅ pass — 3 files / 14 tests passed | 655ms |
| 2 | `yarn lint` | 0 | ✅ pass — 0 errors, 3 existing warnings | 4448ms |
| 3 | `yarn check:language` | 0 | ✅ pass — English code convention check passed | 598ms |
| 4 | `yarn build` | 1 | ❌ initial fail — TypeScript rejected process.env default parameter type in lib/auth/registration.ts | 12805ms |
| 5 | `yarn vitest tests/registration-config.test.ts tests/auth-actions-registration.test.ts tests/auth-route-registration.test.ts && yarn lint && yarn check:language && yarn build` | 0 | ✅ pass — full required slice verification pipeline passed | 23610ms |

## Deviations

A small type-only fix was made in `lib/auth/registration.ts` after production build verification exposed that `process.env` needed an explicit cast to the local `RegistrationEnv` test seam. Runtime behavior was unchanged.

## Known Issues

ESLint reports three pre-existing unused-variable warnings in `components/categories/category-settings-panel.tsx`, `components/import/import-table.tsx`, and `tests/pattern-actions.test.ts`; lint exits 0 and they were not introduced by this task.

## Files Created/Modified

- `.env.example`
- `docs/deploy/vercel-supabase-r2.md`
- `lib/auth/registration.ts`
