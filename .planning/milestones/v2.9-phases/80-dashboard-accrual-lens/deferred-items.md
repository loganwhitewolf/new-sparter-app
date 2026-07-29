# Deferred Items — Phase 80

Out-of-scope discoveries logged during execution, per executor deviation rules (SCOPE BOUNDARY).
Not fixed here — pre-existing, unrelated to the files this plan touches.

## 80-07: Staging-bypass infinite redirect loop blocks ALL Playwright dashboard specs

**Found during:** Plan 80-07, Task 1 (Playwright coverage for the lens switch)

**File:** `proxy.ts` (staging-bypass branch, lines 13-18) — last touched 2026-04-25 (commit
`cff3b7464`), long before Phase 80. Confirmed pre-existing via `git blame`.

**Symptom:** Every Playwright spec in `tests/dashboard.spec.ts` — including the five pre-existing
`DASH-01`/`DASH-02` cases untouched by this plan — fails with `net::ERR_TOO_MANY_REDIRECTS`
against a local `yarn dev` server (`http://127.0.0.1:3000/dashboard/...`).

**Root cause (diagnosed via `curl -v -L` against the running dev server):**
- `proxy.ts`'s staging-bypass branch (`request.headers.get('x-staging-key') === process.env.STAGING_KEY`)
  returns `NextResponse.next()` immediately, WITHOUT setting the `x-pathname`/`x-search` request
  headers that the normal (non-bypass) path sets a few lines below.
- `app/(app)/layout.tsx`'s onboarding gate (D-11) reads `x-pathname` to decide whether the current
  route is exempt from the zero-transaction → `/onboarding` redirect (`/onboarding`, `/settings/*`,
  `/import/*`, `/tags`, `/patterns` are exempt).
- Under the staging bypass, `x-pathname` is always the empty string, so `isExempt` is always
  `false` — even when the actual request IS to `/onboarding` itself.
- If the staging user (`STAGING_USER_ID` env var, defaults to `'staging-user'`) has
  `getTransactionCount(userId) === 0` and no `onboardingCompletedAt`, every single request
  (including the redirect target `/onboarding`) redirects to `/onboarding` again → infinite loop.
- Confirmed directly: `curl -H "x-staging-key: <key>" -L http://127.0.0.1:3000/dashboard/overview`
  shows `location: /onboarding` repeating past `--max-redirs 5`.

**Why not fixed here:** `proxy.ts` and `app/(app)/layout.tsx` are not in this plan's
`files_modified` (`tests/dashboard.spec.ts` only) and the bug is unrelated to the lens-switch
feature — it blocks the ENTIRE Playwright suite, not just the new LENS tests. Per the executor's
SCOPE BOUNDARY rule, pre-existing failures in unrelated files are logged, not auto-fixed.

**Suggested fix (for a future quick task or phase):** in `proxy.ts`'s staging-bypass branch, set
the same `x-pathname`/`x-search` headers the normal path sets before calling `NextResponse.next()`
(mirroring the non-bypass branch at lines 51-59), OR seed the staging user with
`onboardingCompletedAt` set / at least one transaction, so the onboarding gate's zero-transaction
branch never fires for staging/E2E traffic.

**Impact on this plan:** the five new `Dashboard - LENS: ...` Playwright cases in
`tests/dashboard.spec.ts` are authored faithfully per the 80-07-PLAN.md task spec (exact button
names, `aria-pressed` assertions, disabled-state assertions, tab-navigation URL assertion,
graceful-degradation fallback for `/tags/[id]`) but could not be driven to a green run in this
sandbox — see `80-07-SUMMARY.md`'s Known Stubs / coverage rationale for the full detail, consistent
with the precedent set by quick task 260709-gfz.
