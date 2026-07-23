# Phase 74: public-layout-and-proxy-allowlist - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the production infrastructure for anonymous marketing pages: dedicated `(public)` route-group layout (header/nav/footer — no AppShell, sidebar, or onboarding gate); single-source-of-truth public allowlist in `lib/routes.ts` wired into `proxy.ts`; smart root (anon `/` → marketing homepage shell, auth `/` → `/dashboard`). Includes minimal stub pages for linked routes and a minimal homepage shell so chrome is end-to-end verifiable.

This phase does **not** ship full Variant C homepage content (`components/marketing/*`), legal MDX bodies, SEO/sitemap/robots, or session-aware header polish — those are Phases 75–77 (current numbering; see numbering note below).

**Milestone:** v2.9 Public Branding Site on `feat/v29-public-branding` (`origin/main` owns v2.8 Reimbursements 1:N).

**Numbering note (expected churn):** Phase IDs **73–77 are provisional**. When v2.8 Reimbursements claims phase numbers on `main`, branding phases will be renumbered again. Decisions in this file stay valid; only path prefixes / ROADMAP IDs change. Do not block planning on that renumber.

</domain>

<decisions>
## Implementation Decisions

### Smart root (BRAND-05)
- **D-01:** Auth → `/dashboard` redirect for path `/` lives **only in `proxy.ts`** (not duplicated in RSC page). Anon passes through to `(public)` homepage shell. — **Reversibility:** costly — moving smart root to page later means two layers or a migration of tests/allowlist assumptions.
- **D-02:** Authenticated users hitting `/` **always** redirect to `/dashboard` (no `/?marketing=` escape hatch).
- **D-03:** Marketing deep links (`/how-it-works`, `/privacy`, `/terms`) remain reachable when logged in — they must **not** be added to `AUTH_ROUTES` (only `/login` and `/register` bounce authenticated users to dashboard).
- **D-04:** Allowlist matching for marketing + auth paths is **exact match only**. Exception retained: `/proto` keeps `path.startsWith('/proto')` as today.

### Allowlist SoT (BRAND-04)
- **D-05:** In `lib/routes.ts`: export `PUBLIC_MARKETING_ROUTES` (`/`, `/how-it-works`, `/privacy`, `/terms`), `AUTH_ROUTES` (`/login`, `/register`), and `PUBLIC_ROUTES = [...PUBLIC_MARKETING_ROUTES, ...AUTH_ROUTES]`. `proxy.ts` imports these — delete the local hard-coded arrays. — **Reversibility:** costly — chrome, proxy, and tests all depend on the shared export.
- **D-06:** Chrome (header/footer/sheet) references **named route constants** (not string literals). Dashboard link uses `APP_ROUTES.dashboard`.
- **D-07:** Phase ships **targeted automated tests** for: anon `/` not 307→login; auth `/` → dashboard; auth `/how-it-works` → 200; non-allowlisted path still gated.

### Public chrome extensions (extends 74-UI-SPEC)
- **D-08:** Always-visible **“Dashboard”** text link → `/dashboard` in **footer only** (desktop) and also in the **mobile Sheet** link list. Anon click → proxy → `/login`. This extends the UI-SPEC nav inventory (UI-SPEC originally omitted it until Phase 77).
- **D-09:** Entra / Registrati remain always visible in Phase 74; authenticated click still hits `AUTH_ROUTES` → `/dashboard`. Session-aware hide of Registrati stays Phase 77 (BRAND-12).

### Stub pages & homepage shell (BRAND-03 + chrome verification)
- **D-10:** Ship stub pages for `/how-it-works`, `/privacy`, `/terms` inside `(public)` layout: heading + body **“Contenuto in arrivo.”** + text link **“Torna alla home”** → `/`. No fake legal prose.
- **D-11:** Homepage `/` in this phase is the **minimal type-led shell** from `74-UI-SPEC.md` (brand + import-first supporting line + Registrati/Entra CTAs). Full Variant C promotion is Phase 75.
- **D-12:** Follow `74-UI-SPEC.md` for chrome structure, spacing, typography (Geist-only), colors, Sheet behavior, and copy — except where D-08 explicitly extends the link inventory. Do **not** create `components/marketing/*` or load Fraunces in this phase.

### Claude's Discretion
- Exact file layout under `app/(public)/` (`_components/site-header.tsx` vs inline) as long as UI-SPEC placement rule is met (colocate under `(public)`, no `components/marketing/*`).
- Exact Sheet ordering for “Dashboard” among footer-equivalent links (must be present; prefer after legal links or with product links — planner picks one coherent order).
- Test harness choice (unit vs integration) — prefer whatever already exists for proxy/routes if present; otherwise minimal new tests that lock D-07.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — BRAND-03, BRAND-04, BRAND-05 (active v2.9 branding on this branch)
- `.planning/ROADMAP.md` — Phase 74 goal and success criteria; Phases 75–77 boundary
- `.planning/PROJECT.md` — Parallel Branch Milestone v2.9; main owns v2.8 Reimbursements
- `.planning/milestones/v2.8-REQUIREMENTS.md` — Do not implement RMB-* here; numbering collision context only
- `.planning/STATE.md` — Current focus Phase 74

### UI contract (approved)
- `.planning/phases/74-public-layout-and-proxy-allowlist/74-UI-SPEC.md` — Public chrome + stub + homepage shell contract (approved 2026-07-23). **Must read.** Decisions D-08 extend footer/Sheet inventory.

### Design lock (upstream)
- `app/proto/branding/NOTES.md` — Winner = c (type-led stack); steal notes for Phase 75 content, not this chrome phase
- `.planning/phases/73-proto-design-variants/73-CONTEXT.md` — D-02/D-04/D-08/D-09 carried forward

### Research
- `.planning/research/ARCHITECTURE.md` — `(public)` sibling layout; `PUBLIC_MARKETING_ROUTES` / `PUBLIC_ROUTES` pattern; proxy+routes SoT
- `.planning/research/PITFALLS.md` — Allowlist gaps; smart root in one layer; no AppShell leak; Server Actions `next-action` bypass must stay
- `.planning/research/FEATURES.md` — Nav/footer inventory; no Pricing

### Live code
- `proxy.ts` — Current local `PUBLIC_ROUTES` / `AUTH_ROUTES`; staging bypass; `next-action` passthrough; session via `getAuthSessionOrNull`
- `lib/routes.ts` — `APP_ROUTES` today; extend with marketing/public/auth exports (D-05)
- `app/page.tsx` — Today always `redirect('/dashboard')`; replace with `(public)` homepage ownership for `/`
- `app/(app)/layout.tsx` — Onboarding gate / AppShell — must not wrap `(public)`
- `app/(auth)/layout.tsx` — Wordmark type treatment baseline for chrome continuity
- `CLAUDE.md` / `AGENTS.md` — English route slugs; Italian UI copy

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- shadcn `Button`, `Sheet` — mobile nav per UI-SPEC; no new registry blocks
- `APP_ROUTES.dashboard` — Dashboard footer/Sheet link target
- `(auth)/layout.tsx` wordmark (`text-2xl font-semibold tracking-tight`) — match in public header/footer
- `getAuthSessionOrNull` — already used in `proxy.ts` for smart root / auth redirects

### Established Patterns
- Deny-by-default proxy: only explicit public paths + `/proto` prefix skip login redirect
- `AUTH_ROUTES` redirect authenticated users away from login/register to `/dashboard`
- Route groups `(app)` / `(auth)` / `proto` already separate chrome; `(public)` is the new sibling
- Proto Preview gate is unrelated — do not reuse `PROTOTYPES_ENABLED` for production `(public)`

### Integration Points
- Replace/remove root `app/page.tsx` redirect-only behavior in favor of `app/(public)/page.tsx` (route group URL `/`) — cannot keep both
- `proxy.ts` must import allowlist from `lib/routes.ts` and add auth-`/` → dashboard before/alongside public pass-through
- Preserve staging-key bypass and `next-action` short-circuit order when editing proxy
- Footer/Sheet link slots must use constants that match allowlisted paths exactly

</code_context>

<specifics>
## Specific Ideas

- User explicit: once logged in, must still open “Come funziona” (and other public marketing pages) — do not treat marketing paths like auth pages.
- User chose always-visible “Dashboard” link in Phase 74 (not wait for session-aware Phase 77) so logged-in visitors can return to the app from marketing chrome.
- Homepage shell supporting line (from UI-SPEC): **Carica i tuoi estratti. Sparter li categorizza — senza collegare la banca.**
- Phase numbers may change again after v2.8 Reimbursements allocates its roadmap — keep decisions portable.

</specifics>

<deferred>
## Deferred Ideas

- Full Variant C homepage + `components/marketing/*` + Fraunces — Phase 75
- `/how-it-works` 3–5 step body — Phase 75
- Privacy / Terms legal MDX — Phase 76
- Session-aware header (hide Registrati when authenticated) — Phase 77 / BRAND-12
- SEO metadata, sitemap, robots — Phase 77 / BRAND-11
- Sign-out → `/` — Phase 77 / BRAND-13
- Pricing page — out of scope (BRAND-F01)
- Renumber branding phases when v2.8 Reimbursements claims phase IDs — process/docs chore after that milestone’s roadmap exists

None folded from todos (no todo matches for Phase 74).

</deferred>

---

*Phase: 74-public-layout-and-proxy-allowlist*
*Context gathered: 2026-07-23*
*Milestone: v2.9 Public Branding Site (`feat/v29-public-branding`)*
