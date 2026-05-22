---
phase: "07"
plan: "03"
---

# T03: Built authenticated /profile page (Server Component), ProfileForm client island, topbar navigation wiring, and 11 Playwright smoke tests — all 31 total tests pass

**Built authenticated /profile page (Server Component), ProfileForm client island, topbar navigation wiring, and 11 Playwright smoke tests — all 31 total tests pass**

## What Happened

Created the three output files mandated by the slice plan and updated the topbar.

**app/(app)/profile/page.tsx** — Server Component that calls `verifySession()`, fetches `getUserProfile(session.userId)`, and renders two cards: a read-only Account card (email, subscription plan, role displayed as styled spans with `id` anchors for Playwright targeting) and the editable `ProfileForm` island. The email shown merges `profile.email` with the session email as fallback, matching the failure-mode contract. Subscription plan and role are translated to Italian labels.

**components/profile/profile-form.tsx** — Client Component using `useActionState(updateProfileAction, { error: null })`. Uses a `submittedRef` (pattern from `pattern-actions.tsx`) so the success toast only fires when the form was actually submitted, not on initial render. Each of the six editable fields has a `<label htmlFor>` / `<Input id>` pair with matching names, `maxLength`, and appropriate `autoComplete` attributes. Empty nullable fields default to empty string to avoid uncontrolled/controlled React warnings. The destructive `Alert` is rendered conditionally with `id="profile-form-error"` and `aria-live="polite"` per the MEM009 gotcha (explicit IDs rather than role-based selectors in Playwright). The submit button shows "Salvataggio…" while pending and carries `aria-disabled`.

**components/layout/topbar.tsx** — Added `Link` import, wired the Profilo `DropdownMenuItem` with `asChild` + `<Link href="/profile">`. Added `aria-label="Menu utente"` to the `DropdownMenuTrigger` so Playwright can locate it by accessible name (the avatar image has no src so its alt text is not reliable as the trigger's computed name).

**tests/profile.spec.ts** — 11 Playwright smoke tests across 6 describe groups: PROF-01 (page returns 200 + heading visible), PROF-02 (6 labeled inputs present, verified by name and by `input[name]` selector, no React controlled/uncontrolled warnings), PROF-03 (email/plan/role visible as spans, no corresponding `<input>` elements), PROF-04 (topbar dropdown navigates to /profile), PROF-05 (save button present and enabled), PROF-06 (unauthenticated request redirects to /login). Used `exact: true` for `getByLabel('Nome')` to avoid strict-mode conflict with "Cognome" which contains "Nome" as a substring.

Two test selector fixes were applied after initial run: (1) `getByLabel('Nome', { exact: true })` to prevent the substring match with Cognome, (2) `getByRole('button', { name: 'Menu utente' })` after adding the explicit aria-label to the trigger.

## Verification

Ran the full slice verification command: `npx playwright test tests/profile.spec.ts --reporter=list && npx vitest run tests/profile-actions.test.ts lib/validations/__tests__/profile.test.ts --reporter=verbose`. All 11 Playwright tests and all 20 Vitest tests pass (31 total). Also confirmed `npm run build` succeeds with `/profile` listed as a dynamic route.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx playwright test tests/profile.spec.ts --reporter=list` | 0 | ✅ pass — 11/11 tests passed | 14800ms |
| 2 | `npx vitest run tests/profile-actions.test.ts lib/validations/__tests__/profile.test.ts --reporter=verbose` | 0 | ✅ pass — 20/20 tests passed (2 files) | 847ms |
| 3 | `npm run build` | 0 | ✅ pass — /profile listed as dynamic route, no TypeScript errors | 32000ms |

## Deviations

Added `aria-label="Menu utente"` to the `DropdownMenuTrigger` in topbar.tsx — not mentioned in the task plan but required for reliable Playwright targeting after discovering the AvatarImage src is empty (fallback text is not reliably the trigger's computed accessible name).

## Known Issues

none

## Files Created/Modified

- `app/(app)/profile/page.tsx`
- `components/profile/profile-form.tsx`
- `components/layout/topbar.tsx`
- `tests/profile.spec.ts`
