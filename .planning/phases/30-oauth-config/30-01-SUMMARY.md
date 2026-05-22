# Plan 30-01 Summary: Remove Registration Guard

**Phase:** 30-oauth-config
**Plan:** 01
**Status:** Complete

## What was done

Eliminated the registration guardrail and all consumers per REG-01 / D-01 / D-02.

### Files deleted
- `lib/auth/registration.ts` — `isRegistrationEnabled()`, `REGISTRATION_DISABLED_MESSAGE`, `RegistrationEnv`
- `tests/registration-config.test.ts`
- `tests/auth-actions-registration.test.ts`
- `tests/auth-route-registration.test.ts`

### Files modified
- `lib/actions/auth.ts` — removed `isRegistrationEnabled` import and guard block; `signUpAction` now proceeds directly to `RegisterSchema.safeParse`
- `app/api/auth/[...all]/route.ts` — replaced 27-line file with canonical 4-line Better Auth shape: `export const { GET, POST } = toNextJsHandler(auth)`
- `tests/production-smoke.test.ts` — removed `it('passes healthy runtime and disabled-signup rejection...')` and entire `describe('production-smoke CLI disabled-signup phase', ...)` blocks (119 lines removed)
- `tests/production-smoke.spec.ts` — removed `expectDisabledSignup` helper, `test.skip(PLAYWRIGHT_SMOKE_EXPECT_REGISTRATION_DISABLED)` line, and `test('disabled registration rejects direct signup...')` block

## Residual-reference audit

```
grep -rE "isRegistrationEnabled|REGISTRATION_DISABLED_MESSAGE|RegistrationEnv|@/lib/auth/registration" lib/ app/ --include="*.ts" --include="*.tsx"
→ 0 matches
```

## Gate results

### TypeScript (`yarn tsc --noEmit`)
Pre-existing errors unrelated to this plan remain (production-smoke.test.ts:66 `NODE_ENV`, set-r2-cors.test.ts ×4). Our changes resolved the previously-present `Cannot find module '@/lib/auth/registration'` error from the old route.ts import.

### Tests (`yarn test`)
```
Test Files  48 passed (48)
Tests       527 passed (527)
Duration    2.02s
```

## Commits
- `7f1ff90` feat(30-01): delete registration module and dedicated test files
- `df79150` feat(30-01): remove registration guard from signUpAction
- (smoke test cleanup) feat(30-01): strip disabled-signup blocks from production smoke tests
