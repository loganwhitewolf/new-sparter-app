# S04 Research: Registration control guardrail

## Summary
S04 is a targeted auth guardrail slice. The app already has Better Auth email/password registration and login through server actions and a catch-all Better Auth API route. S01 documented `REGISTRATION_ENABLED` as planned, but no enforcement exists yet. A complete guardrail must block new signup server-side when disabled while preserving login for existing users.

Important finding: guarding only the React register page or only `signUpAction` is insufficient. The app exposes `app/api/auth/[...all]/route.ts` through `toNextJsHandler(auth)`, so direct Better Auth sign-up endpoint calls may bypass a UI-only or server-action-only check. S04 should add a shared server-side registration flag helper and enforce it in both the server action and the Better Auth route surface (or a Better Auth config hook if verified) while leaving sign-in untouched.

Active requirements supported/owned: R042 (app-level registration control), R038/R045 (zero-cost demo/free-tier abuse guardrail), R043/R044 (diagnostic/runbook behavior), and S05 integrated signup/login smoke proof.

## Recommendation
Implement a small shared server-only registration config/guard and apply it at every signup entry point.

Recommended behavior:
- Default `REGISTRATION_ENABLED` to enabled unless explicitly set to `false`/`0`/`no`? The milestone says signup is open when enabled and can be disabled. Because S01 `.env.example` shows planned `REGISTRATION_ENABLED=true`, prefer an explicit parser with documented defaults. A safe demo default is `true` for backwards compatibility; production docs should recommend setting it intentionally.
- Add `lib/auth/registration.ts` or `lib/auth/registration-config.ts` with pure helpers such as `isRegistrationEnabled(env)` and `registrationDisabledResponseMessage`.
- In `lib/actions/auth.ts`, make `signUpAction` return a clear Italian user-facing error before validation/Better Auth when disabled. Keep `signInAction` unchanged.
- In `app/(auth)/register/page.tsx`, optionally render disabled-state copy and disable form submission. This is UX only, not the guardrail.
- In `app/api/auth/[...all]/route.ts`, wrap the exported POST handler or configure Better Auth to reject sign-up requests when registration is disabled. This protects direct API calls. Login/session endpoints must still pass through.
- Update `.env.example` and `docs/deploy/vercel-supabase-r2.md` to say changing `REGISTRATION_ENABLED` in Vercel requires redeploy and does not affect existing login.

## Implementation landscape
Key files:
- `auth.ts` — Better Auth configuration with `emailAndPassword.enabled: true`, `autoSignIn: true`. Potential hook/config location if Better Auth supports disabling signup while preserving signin.
- `lib/actions/auth.ts` — server actions for `signInAction`, `signUpAction`, and `signOutAction`; `signUpAction` currently always calls `auth.api.signUpEmail` after Zod validation.
- `app/(auth)/register/page.tsx` — client register UI using `useActionState(signUpAction)`.
- `app/(auth)/login/page.tsx` — login UI should remain functional when registration is disabled.
- `app/api/auth/[...all]/route.ts` — exports raw Better Auth GET/POST handlers; must not leave signup open.
- `lib/validations/auth.ts` — form schemas; likely no change needed.
- `.env.example` — already includes planned `REGISTRATION_ENABLED=true` comment from S01; update from planned to implemented.
- `docs/deploy/vercel-supabase-r2.md` — update Vercel env table/runbook with enabled/disabled smoke steps.
- Tests: add targeted unit tests for the parser and server action/route guard. Existing `tests/auth.spec.ts` Playwright tests are mostly `fixme`; do not rely only on them.

Existing behavior:
- Invalid registration returns generic Italian errors to avoid account enumeration.
- Better Auth requires `name` in signup; current action uses email as placeholder.
- Auth routes `/login` and `/register` are public in `proxy.ts`; server actions pass through proxy via `next-action` header and must self-enforce.

## Natural seams for planning
1. **Flag parser seam**: pure helper tests for env values (`true`, unset, `false`, `0`, whitespace/malformed). Decide and document default.
2. **Server action guard seam**: `signUpAction` early return when disabled; ensure it does not call `auth.api.signUpEmail`. `signInAction` remains unchanged.
3. **Direct API route guard seam**: wrap Better Auth POST or use verified Better Auth config hook so `/api/auth/sign-up/email` is blocked when disabled and sign-in endpoints still work.
4. **UI/docs seam**: register page communicates disabled state; docs describe Vercel env toggle/redeploy and existing-user login proof.
5. **Verification seam**: unit tests around guard behavior plus smoke/manual S05 instructions.

## First proof
The first proof should be server-side, not UI. Prove `REGISTRATION_ENABLED=false` prevents account creation before Better Auth is invoked.

Suggested tests:
- Pure parser: explicit false values disable; true/unset behavior matches the documented default.
- `signUpAction` with disabled env returns the disabled message and does not call `auth.api.signUpEmail`.
- `signInAction` still calls `auth.api.signInEmail` under disabled registration.
- Direct API route POST to sign-up path is rejected when disabled, while a non-signup auth POST is delegated to Better Auth handler (can be mocked).

## Verification
Static/command checks:
- `yarn vitest tests/registration-config.test.ts tests/auth-actions.test.ts` (names flexible; add route guard test if feasible).
- `yarn lint`
- `yarn check:language` because this touches comments/docs/developer-facing env docs; Italian UI copy is allowed.
- `yarn build`

Behavioral/S05 smoke:
- With `REGISTRATION_ENABLED=true`, browser registration creates/logs in a user and redirects to `/dashboard`.
- With `REGISTRATION_ENABLED=false` after Vercel env change and redeploy, new registration is blocked server-side with a clear message.
- Existing user login still works while registration is disabled.
- Direct signup endpoint/API call is blocked when disabled; do not rely on hiding the UI.

## Risks and constraints
- Better Auth may expose sign-up through its own route independent of server actions. Do not ship a UI/server-action-only guard.
- `proxy.ts` explicitly lets server actions pass through, so action-level auth/registration logic must be self-contained.
- Avoid account enumeration regressions: disabled-registration copy can be explicit, but duplicate/credential errors should remain generic as currently implemented.
- Changing env vars in Vercel requires redeploy; docs and S05 runbook must include this.
- Developer-facing code/comments/test names must be English; user-facing UI messages may remain Italian.

## Skill discovery
Relevant installed skills: `api-design` can inform direct API route behavior/status shape; `observability` applies if adding logs for blocked signup (log only event and disabled flag state, no credentials); `write-docs` for runbook updates. No external skill installation is required.

## Sources
- Memory: MEM189 zero-cost stack/demo constraints; registration memory search had no direct prior registration-guard architecture beyond logger/staging gotchas.
- Code scan: `auth.ts`, `lib/actions/auth.ts`, `app/(auth)/register/page.tsx`, `app/(auth)/login/page.tsx`, `app/api/auth/[...all]/route.ts`, `proxy.ts`, `.env.example`, `docs/deploy/vercel-supabase-r2.md`, S01 summary.
