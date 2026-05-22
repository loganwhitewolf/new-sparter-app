# S07 Research — User Profile

## Summary

S07 is a targeted application slice. The only active product requirement I found for this scope is **PROF-01** from `.planning/REQUIREMENTS.md`: the authenticated user can view and edit personal profile fields `firstName`, `lastName`, `jobTitle`, `location`, `phone`, and `timezone`. Existing app/auth foundations are usable, but the current database schema does **not** contain these fields yet.

The implementation should add nullable profile columns to the existing Better Auth `user` table, add a small `users` DAL + validation + server action layer, then render `/profile` as an authenticated Server Component with a client form for mutation feedback. Email, subscription plan, and role already exist and can be displayed read-only, but should not be editable by the user in this slice.

## Recommendation

Build the slice in this order:

1. **Schema + migration first** — extend `lib/db/schema.ts` `user` table with nullable `firstName`, `lastName`, `jobTitle`, `location`, `phone`, `timezone`; generate a Drizzle migration. This is the only real blocker because PROF-01 fields are absent today.
2. **Server boundary** — add `lib/dal/users.ts`, `lib/validations/profile.ts`, and `lib/actions/profile.ts`. Every read/write must call or consume `verifySession()` and update rows by `user.id` only.
3. **UI route** — add `app/(app)/profile/page.tsx` plus a client form component (e.g. `components/profile/profile-form.tsx`) using existing shadcn-style `Card`, `Input`, `Button`, `Alert`, `useActionState`, and `sonner` patterns.
4. **Navigation** — make the existing Topbar dropdown “Profilo” item a real `Link` to `/profile`; optionally add desktop/mobile navigation if desired, but the topbar is the already-visible seam.
5. **Tests** — unit-test validation/actions/DAL shape and add a Playwright smoke for the profile route/form shell under the staging auth header.

## Requirement Target

- **PROF-01**: User can view and modify personal information: `firstName`, `lastName`, `jobTitle`, `location`, `phone`, `timezone`.

Do not expand the slice to avatar upload, notification preferences, admin role UI, OAuth, password reset, or editable subscription management. `.planning/REQUIREMENTS.md` explicitly lists avatar upload, notification preferences, and admin UI as out of scope/v2-adjacent; `docs/init/BUSINESS_LOGIC_HANDOFF.md` says subscription is readonly for the user and admin-managed.

## Implementation Landscape

### Existing auth/session surface

- `auth.ts`
  - Better Auth config already uses Drizzle adapter and extends `user.additionalFields` for `subscriptionPlan` and `role` with `input: false`.
  - Email/password is enabled; `autoSignIn: true` is set.
  - If executors want profile fields available through Better Auth session/client, add them to `additionalFields`; otherwise DAL reads from DB are enough for the profile page.

- `lib/dal/auth.ts`
  - `verifySession()` is cached and returns `{ userId, email, subscriptionPlan, role }`.
  - Supports staging bypass when request header `x-staging-key` matches `process.env.STAGING_KEY`.
  - Staging user id defaults to `process.env.STAGING_USER_ID ?? 'staging-user'`.
  - Profile DAL/action should follow the same authoritative session pattern.

- `lib/actions/auth.ts`
  - Existing auth actions show the project convention: top-level `'use server'`, Zod validation, generic Italian error messages, `redirect()` for auth navigation.
  - `signOutAction()` exists and is used in the topbar.

### Existing user schema state

- `lib/db/schema.ts`
  - Current `user` columns: `id`, `name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt`, `subscriptionPlan`, `role`.
  - Missing all PROF-01 fields.
  - Related rows cascade on user deletion for sessions, accounts, expenses, files, transactions, patterns, and classification history.

- `drizzle/migrations/`
  - Current migrations end at `0002_far_may_parker.sql`.
  - Use `npm run db:generate` after editing schema; do not hand-write production migration unless generation fails.
  - Project research says `drizzle-kit push` is forbidden for production; use generate + migrate.

### Existing app/UI patterns to reuse

- `app/(app)/layout.tsx`
  - Authenticated shell renders `Sidebar`, `Topbar`, and `BottomNav` around page content.

- `components/layout/topbar.tsx`
  - Already has a dropdown item labelled `Profilo`, but it is not linked.
  - Uses `authClient.useSession()` and derives avatar fallback from email.
  - Natural change: wrap the Profile dropdown item with `asChild` + `Link href="/profile"` or otherwise make it navigate.

- `components/layout/sidebar.tsx`
  - Has bottom nav item `{ href: '/settings', label: 'Impostazioni' }`, but no `/settings` route exists.
  - Existing pattern management route is `/impostazioni/pattern`.
  - Planner can choose whether to leave this alone or align settings/profile navigation; the minimal PROF-01 path only needs topbar access.

- `components/expenses/expense-form-dialog.tsx`, `components/patterns/create-pattern-dialog.tsx`, `components/patterns/pattern-actions.tsx`
  - Good patterns for client forms with `useActionState`, a `submittedRef`, toast success, inline `Alert` errors, and disabled submit while pending.
  - Profile form can be simpler: no dialog needed, just a client form component receiving the current profile DTO.

- `app/(app)/impostazioni/pattern/page.tsx`
  - Good authenticated settings-like Server Component pattern: call `verifySession()`, fetch DAL data, render header + empty/paid states.
  - Profile page should similarly fetch `getUserProfile(userId)` and render with Italian copy.

### Existing test patterns

- `tests/import-api.test.ts`
  - Shows Vitest mocking pattern with `vi.hoisted()`, `vi.mock('@/lib/dal/auth')`, and dynamic imports after mocks.
  - Reuse this for `profile` action tests: mock `verifySession` and `updateUserProfile`/`getUserProfile`.

- `tests/layout.spec.ts`, `tests/dashboard.spec.ts`, `tests/import.spec.ts`
  - Playwright tests use `page.setExtraHTTPHeaders({ 'x-staging-key': process.env.STAGING_KEY ?? 'test-staging-key' })` for authenticated routes.
  - Add profile smoke tests in the same style.
  - Be careful: if the profile page does a real DB read for `staging-user`, the DAL should return a safe fallback or tests will require seeded DB state. Prefer server page can derive readonly email/plan from `verifySession()` and profile fields from DAL; for smoke stability, DAL can return `null`/empty DTO when no row is found rather than throwing.

## Natural Seams for Planning

1. **Data model seam**
   - Files: `lib/db/schema.ts`, generated `drizzle/migrations/*`, maybe `auth.ts` if adding additional fields to Better Auth config.
   - Output: DB can store PROF-01 fields.

2. **Profile domain seam**
   - Files: `lib/validations/profile.ts`, `lib/dal/users.ts`, `lib/actions/profile.ts`, likely `tests/profile-actions.test.ts` or `tests/profile.test.ts`.
   - Output: user-scoped DTO read/update contract with validation and generic safe errors.

3. **UI seam**
   - Files: `app/(app)/profile/page.tsx`, `components/profile/profile-form.tsx`, `components/layout/topbar.tsx`.
   - Output: authenticated profile page displays readonly account data and editable personal info.

4. **Navigation/smoke seam**
   - Files: `tests/profile.spec.ts`, maybe layout tests if changing nav behavior.
   - Output: `/profile` is discoverable and renders under staging auth.

## Better Auth Notes

Context7 docs for Better Auth 1.6.x show:

- `auth.api.changePassword({ body: { newPassword, currentPassword, revokeOtherSessions }, headers })` exists, but password change is **not** part of PROF-01.
- `authClient.updateUser({ name, image })` and server `auth.api.updateUser({ body: ... })` exist for basic user info, but PROF-01 fields are custom columns. Direct DAL updates are simpler and more explicit unless the team wants those fields in Better Auth session/client data.
- Additional user fields can be configured under `user.additionalFields`; `input: false` prevents users from supplying sensitive fields during auth flows. Existing `subscriptionPlan` and `role` correctly use `input: false`.

Recommendation: for PROF-01, keep subscription/role `input: false`; if adding `firstName`/etc. to `auth.ts`, do not set `input: false` unless you want Better Auth to reject user-supplied updates through auth APIs. Since the app can mutate through its own server action + DAL, adding them to `auth.ts` is optional.

## Next.js / React Rules That Matter

Read from `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` and `node_modules/next/dist/docs/01-app/02-guides/forms.md`:

- Server Actions/Functions are directly reachable by POST, so each action must verify authentication/authorization internally. Do not rely on `(app)` layout or proxy protection alone.
- Client Components cannot define Server Functions; put profile mutations in a `'use server'` file such as `lib/actions/profile.ts` and import them into a client form.
- `useActionState` changes the action signature to `(prevState, formData)`, matching existing project form components.
- Zod server-side validation is the documented pattern for form submissions.

Installed skills that inform execution:

- `react-best-practices` — keep `/profile/page.tsx` as a Server Component and push `'use client'` down to the form only.
- `accessibility` / `web-design-guidelines` — label every input with `htmlFor`, keep focus-visible states, use accessible alerts/status messages, and preserve keyboard submission.
- `verify-before-complete` — executors must produce fresh test/build output before claiming done.

## Suggested Validation Rules

Create `ProfileSchema` with these fields:

- `firstName`, `lastName`: optional trimmed string, max ~80.
- `jobTitle`, `location`: optional trimmed string, max ~120.
- `phone`: optional trimmed string, max ~40; do light validation only (Italian/international phone formats vary), e.g. allow digits, spaces, `+`, `-`, `(`, `)`.
- `timezone`: optional string from a small allowlist or at least validate against `Intl.supportedValuesOf('timeZone')` when available. Default suggestion for UI: `Europe/Rome`.

Normalize empty strings to `null` before DB writes so the table does not accumulate meaningless empty values.

## Risks / Pitfalls

- **Schema mismatch is the main risk**: the PROF-01 fields are documented in planning docs but not present in `lib/db/schema.ts` or migrations.
- **Do not make subscription editable**: `subscriptionPlan` gates import/categorization behavior already validated in S06; user edits would undermine ADV-04.
- **Avoid accidental client DB imports**: keep DAL files server-only (`import 'server-only'`) and do not import DAL into client components.
- **Staging smoke tests may fail if DAL throws for missing `staging-user`**: either seed a staging user or have `getUserProfile()` return an empty editable DTO plus session readonly fields when no DB row exists. For real actions, updates should still require the row to exist and return a safe error if not.
- **Route language consistency**: architecture says `/profile`, existing Italian settings route says `/impostazioni/pattern`, sidebar points to nonexistent `/settings`. Minimal implementation should use `/profile` because it is in the architecture and topbar already says “Profilo”. A broader settings nav cleanup is separable.

## Verification Plan

Recommended commands:

1. `npm run db:generate` after schema changes, then inspect generated migration.
2. `npx vitest run tests/profile*.test.ts lib/validations/__tests__/profile.test.ts --reporter=verbose`
   - Validate trimming/null normalization.
   - Action rejects invalid input before DAL update.
   - Action calls `verifySession()` and updates only the current `userId`.
   - Free/basic/pro readonly plan display does not affect update payload.
3. `npx playwright test tests/profile.spec.ts --reporter=list`
   - `/profile` renders under staging auth.
   - Profile form has labeled fields for first name, last name, job title, location, phone, timezone.
   - Topbar Profile dropdown navigates to `/profile`.
4. `npm run build`
   - Confirms Next.js 16/React 19 route compilation and type checking.

## Skill Discovery

Already installed and directly useful:

- `react-best-practices` — Next.js/React component boundary and performance patterns.
- `accessibility` / `web-design-guidelines` — form labeling, keyboard support, status/alert semantics.
- `security-review` (optional if profile expands beyond PROF-01) — useful if adding password/email/delete-account flows, but those are out of scope.

Promising external skills found but **not installed**:

- `better-auth/skills@better-auth-best-practices` — 44.3K installs. Install with `npx skills add better-auth/skills@better-auth-best-practices` if the team wants deeper Better Auth-specific guidance.
- `better-auth/skills@email-and-password-best-practices` — 13.7K installs. Only relevant if expanding to password/email changes.
- `vercel-labs/vercel-plugin@nextjs` — 2.9K installs. General Next.js skill; current project already has local Next 16 docs and installed `react-best-practices`, so optional.
