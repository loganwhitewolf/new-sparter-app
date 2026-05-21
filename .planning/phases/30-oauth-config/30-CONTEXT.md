# Phase 30: oauth-config - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Configure Better Auth to support Google and GitHub OAuth providers, activated by env vars with no code change required. Remove the registration guardrail entirely. Update the deploy runbook and `.env.example` with all OAuth env vars and callback URL format. No UI changes — those are Phase 31.

</domain>

<decisions>
## Implementation Decisions

### Guardrail removal
- **D-01:** Delete `lib/auth/registration.ts`, its test file (`tests/registration-config.test.ts` or equivalent), and remove the `if (!isRegistrationEnabled())` check from `signUpAction` in `lib/actions/auth.ts`. Full elimination — no residual references, no comments, no TODOs. REG-01 removes this capability permanently.
- **D-02:** Remove `REGISTRATION_ENABLED` from `.env.example` and any runbook references to it.

### Provider activation
- **D-03:** In `auth.ts`, use an explicit runtime guard per provider: spread `socialProviders.google` only when `process.env.GOOGLE_CLIENT_ID` is defined, and `socialProviders.github` only when `process.env.GITHUB_CLIENT_ID` is defined. Do not rely on implicit Better Auth behavior for missing credentials.
- **D-04:** Both providers must be independently optional — Google can be active without GitHub and vice versa.

### Documentation updates
- **D-05:** Update `docs/deploy/vercel-supabase-r2.md` with all 4 OAuth env vars (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) and exact callback URL format (`/api/auth/callback/google`, `/api/auth/callback/github`).
- **D-06:** Update `.env.example` with the 4 OAuth env vars, commented out, with a note on where to register the OAuth app (Google Cloud Console / GitHub OAuth Apps).

### Claude's Discretion
- Exact placement of the conditional spread inside `auth.ts` (inline vs helper function)
- Whether to add a `BETTER_AUTH_URL` note in the runbook for callback URL construction

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth configuration
- `auth.ts` — Current Better Auth config; social providers must be added here with conditional spread
- `lib/auth/registration.ts` — Module to be deleted entirely (D-01)
- `lib/actions/auth.ts` — `signUpAction` contains the `isRegistrationEnabled()` call to remove

### Schema
- `lib/db/schema.ts` §account (L97) — `account` table already exists; no migration needed for Phase 30

### Deploy documentation
- `docs/deploy/vercel-supabase-r2.md` — Runbook to update with OAuth env vars and callback URLs (ENV-03)
- `.env.example` — Env template to update with 4 OAuth vars commented out

### Requirements
- `.planning/REQUIREMENTS.md` §ENV-01, ENV-02, ENV-03, REG-01 — Acceptance criteria for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `auth.ts`: existing `betterAuth()` call with `emailAndPassword`, `drizzleAdapter`, `nextCookies()` — social providers slot in as `socialProviders: {}` at the same level
- `lib/db/schema.ts`: `account` table (L97) already covers Better Auth's social account storage — no migration needed

### Established Patterns
- Env-conditional features: no existing pattern in this codebase for runtime-conditional Better Auth plugins, but the spread pattern (`...(condition ? { key: value } : {})`) is idiomatic TypeScript
- Tests: `tests/registration-config.test.ts` (or similar) covers `isRegistrationEnabled()` — this file is deleted as part of D-01

### Integration Points
- `lib/actions/auth.ts:signUpAction` — only consumer of `isRegistrationEnabled()`; remove import + guard
- `proxy.ts` — handles session checks only, no registration logic; no changes needed here
- Phase 31 will consume the social providers added here to render UI buttons

</code_context>

<specifics>
## Specific Ideas

No specific UI or behavioral references — Phase 30 is backend/config only. Provider buttons are Phase 31.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 30-oauth-config*
*Context gathered: 2026-05-21*
