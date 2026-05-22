# Retrospective

Living retrospective — one section per milestone, newest first.

---

## Milestone: v1.9 — Social Auth

**Shipped:** 2026-05-22
**Phases:** 3 (30, 31, 32) | **Plans:** 9 | **Commits:** 45

### What Was Built

- Registration guardrail deleted — `lib/auth/registration.ts` and all consumers removed
- Env-conditional Google + GitHub OAuth providers wired into Better Auth via conditional spread
- `SocialProviderButtons` shared client component with inline SVG GitHub icon and Italian error mapping
- Login/Register pages converted to async server components that read `process.env` for active providers
- Settings IA reorganized: `/settings` hub, `/settings/profile` canonical page, `/profile` compat redirect shim
- `ConnectedAccountsCard` — link/unlink flows, `canUnlink` guard, confirmation Dialog, error code decoding

### What Worked

- **Wave 0 TDD scaffolding** (plans 31-01, 32-00): Writing unit specs before implementation made the contracts explicit and caught the lucide-react icon bug early. Both plans ran in ~15 minutes — fast and high-value.
- **Conditional spread pattern for OAuth providers**: Clean, no-code-change activation model. Clear activation signal (CLIENT_ID presence). Documented as an established pattern.
- **Server component + 'use client' split for provider visibility**: No `NEXT_PUBLIC_*` vars needed. The server reads `process.env`, passes booleans down. Simple and correct.
- **`canUnlink` guard based on credential OR other social**: More robust than counting all accounts. Correctly handles the edge case where a user has only one provider linked.
- **Phase 32 code review** (32-REVIEW.md): Caught 3 real issues (CR-01/02, WR-01..03, IN-01..03) including the `errorCallbackURL` bare-URL fix (D-12). Review → fix → commit was clean.

### What Was Inefficient

- **lucide-react icon miss**: RESEARCH.md claimed lucide-react exported a Github icon — it doesn't at v1.14.0. Required an unplanned inline SVG fallback. Better to grep `node_modules` before claiming a dependency provides something.
- **React 19 `renderToStaticMarkup` apostrophe encoding**: Wave 0 test assertion used `'` but React 19 encodes as `&#x27;`. Required a small fix after Wave 0 ran. Worth noting in future Wave 0 test setups using `renderToStaticMarkup`.
- **Traceability table staleness**: REQUIREMENTS.md traceability table was not updated in real-time during Phase 32 execution (LINK-01..04 remained "Pending"). Milestone close required a manual correction. Should update traceability at plan completion, not just at the end.

### Patterns Established

- `...(process.env.PROVIDER_CLIENT_ID ? { provider: { clientId, clientSecret! } } : {})` — conditional spread for optional Better Auth social providers
- Server component page wrapper reading `process.env`, passing config booleans to 'use client' forms — no `NEXT_PUBLIC_*` needed
- `test.fixme()` stubs for live OAuth flows that require real credentials — marks the gap without blocking CI
- `renderToStaticMarkup` unit tests: assert with HTML-entity-aware strings (`&#x27;` not `'`)
- `listAccounts` on mount + 400ms delay refresh after `linkSocial` return — accounts for Better Auth's eventual-consistency pattern

### Key Lessons

1. **Grep `node_modules` before claiming a package exports a symbol** — RESEARCH.md was wrong about lucide-react; a quick grep would have caught it.
2. **Update traceability table at plan completion, not milestone close** — stale "Pending" rows in the traceability table add cleanup cost at archival.
3. **`errorCallbackURL` must be bare (no query string)** — Better Auth appends its own error code; passing `?error=OAuthCallbackError` inline breaks the callback. Caught by code review (D-12).
4. **Wave 0 is worth the 15 minutes** — both Wave 0 plans (31-01, 32-00) caught issues that would have cost more to fix post-implementation.

### Cost Observations

- Sessions: 3 (one per phase)
- Timeline: 2 days (2026-05-21 → 2026-05-22)
- Model mix: primarily Sonnet 4.6
- Notable: Phase 32 had 4 plans instead of 3 due to a Wave 0 plan (32-00) — good investment

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Days | Key Pattern |
|-----------|--------|-------|------|-------------|
| v1.8 | 1 | 4 | 1 | Deviation utils + chart focused redesign |
| v1.9 | 3 | 9 | 2 | TDD Wave 0 + server-component config pattern |

**Recurring observations:**
- Wave 0 TDD scaffolding pays for itself on UI-heavy phases
- Code review catches real issues (at least 3 per phase with review)
- Inline SVG fallbacks needed when lucide-react lacks a brand icon
