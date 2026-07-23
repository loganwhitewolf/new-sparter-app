# Domain Pitfalls

**Domain:** Adding a public branding/marketing surface to an existing auth-gated Next.js 16 personal finance app (Sparter v2.8)
**Researched:** 2026-07-22
**Confidence:** HIGH (Sparter codebase verified) / MEDIUM (industry patterns cross-checked)

## Critical Pitfalls

### Pitfall 1: Proxy allowlist gaps — marketing routes still gated

**What goes wrong:**
Anonymous visitors hitting `/`, `/how-it-works`, `/privacy`, or `/terms` receive a 307 to `/login`. Marketing pages never render in production; QA on Preview may look fine if someone is logged in.

**Why it happens:**
Sparter’s `proxy.ts` uses a deny-by-default model: only `/login`, `/register`, and `/proto/*` are public today. New pages under a `(public)` route group do **not** become public automatically — they must be added to `PUBLIC_ROUTES` (or an equivalent prefix allowlist).

**How to avoid:**
- Introduce a single source of truth for public paths (e.g. `PUBLIC_ROUTE_PREFIXES` in `lib/routes.ts` imported by `proxy.ts`).
- Use prefix matching for the public route group (`/`, `/how-it-works`, `/privacy`, `/terms`) rather than exact paths only — avoids missing trailing variants.
- Add proxy integration tests: unauthenticated GET to each new public path must return 200, not 307.
- Treat “page renders in dev while logged in” as **invalid** QA for public routes.

**Warning signs:**
- Incognito window on `/` lands on `/login`.
- Network tab shows 307 before HTML on marketing URLs.
- `PUBLIC_ROUTES` updated in one place but not reflected in tests or docs.

**Phase to address:**
**Phase 2 — Public route group & proxy allowlist** (must complete before any marketing page ships)

---

### Pitfall 2: Smart root mis-implemented — redirect loops or dead ends

**What goes wrong:**
Three failure modes, all common when retrofitting marketing onto an app that today does `app/page.tsx → redirect('/dashboard')`:
1. **Anon dead end:** `/` → `/dashboard` → proxy → `/login` (extra hop, confusing analytics).
2. **Auth loop:** Authenticated user on `/` redirects to `/dashboard`, but something sends `/dashboard` back to `/` → `ERR_TOO_MANY_REDIRECTS`.
3. **Wrong default for returning users:** Logged-in user bookmarking `/` always sees marketing instead of the app.

**Why it happens:**
Root routing is split across `app/page.tsx`, `proxy.ts` (session), and `(app)/layout.tsx` (onboarding gate). Each layer can redirect independently; without an explicit contract, they fight each other.

**How to avoid:**
- Lock the contract in one place (PROJECT.md already states it): **anon → marketing homepage; auth → `/dashboard`** (or `/onboarding` if txCount === 0 — see Pitfall 3).
- Implement smart root in **one** layer only — prefer `app/page.tsx` RSC with session read (Node runtime) over duplicating logic in proxy.
- Keep proxy’s auth-route rule: authenticated users on `/login`/`/register` → `/dashboard` (already exists).
- Add tests for: anon `/`, auth `/`, auth `/` with 0 transactions.

**Warning signs:**
- More than one redirect in the chain for `/`.
- Browser “too many redirects” in staging.
- `app/page.tsx` still unconditionally `redirect('/dashboard')` after marketing work starts.

**Phase to address:**
**Phase 4 — Smart root & auth CTA flows**

---

### Pitfall 3: Public pages placed under `(app)` — session, onboarding gate, and AppShell leak

**What goes wrong:**
Marketing pages render inside `SidebarProvider` + `AppShell` (icon rail, bottom nav, user avatar). Worse: `(app)/layout.tsx` calls `verifySession()` and runs the zero-transaction onboarding redirect — public visitors cannot exist in this tree.

**Why it happens:**
All production pages today live under `(app)` or `(auth)`. The natural mistake is adding `app/(app)/page.tsx` or nesting marketing beside dashboard routes.

**How to avoid:**
- Create a dedicated **`(public)` route group** with its own layout (marketing header/footer, no auth, no DB).
- Mirror the `(auth)` pattern: minimal chrome, centered brand, Italian product copy.
- Explicitly document: `(public)` must never import `AppShell`, `SidebarProvider`, or call `verifySession()`.
- Onboarding gate stays in `(app)/layout.tsx` only — marketing routes never touch `x-pathname` exemptions.

**Warning signs:**
- Sidebar or bottom nav visible on homepage.
- `verifySession` in stack trace for `/`.
- New-user anon flow somehow reaches `/onboarding`.

**Phase to address:**
**Phase 2 — Public route group & proxy allowlist**

---

### Pitfall 4: Mixing marketing chrome with authenticated app shell

**What goes wrong:**
Shared layout components pull in theme toggle, toast, auth-aware nav, or “Entra” + avatar both visible. Marketing feels like a logged-out app screen; authenticated users see double navigation (marketing header + app sidebar).

**Why it happens:**
Reuse without boundary — dropping `ThemeProvider` children into a layout that also mounts app nav, or using the same header component for `(app)` and `(public)`.

**How to avoid:**
- Separate layout components: `PublicShell` vs `AppShell` — share only tokens (`ThemeProvider`, fonts, `Toaster` at root).
- Marketing header: logo, anchor links, `Entra` / `Registrati` CTAs only — no user menu.
- If auth users hitting `/` should redirect (Pitfall 2), they never need avatar chrome on marketing pages.
- Proto variants in `app/proto/` use a minimal `<main>` — do **not** copy that verbatim for production; build `PublicShell` with real nav/footer.

**Warning signs:**
- Figma-approved proto looks right but production page shows sidebar.
- Two competing top bars.
- Marketing links point to `/dashboard` instead of `/login`.

**Phase to address:**
**Phase 3 — Homepage & Come funziona** (layout): **Phase 2** (route group boundary)

---

### Pitfall 5: Italian product slugs vs English route convention

**What goes wrong:**
Routes like `/come-funziona`, `/privacy-policy`, `/termini-e-condizioni` ship alongside the project rule: **English slugs, Italian UI copy**. Legacy localized URLs proliferate; `yarn check:language` fails; future redirects become unmaintainable.

**Why it happens:**
Product copy is Italian; developers naturally Italianize URLs. Stakeholders may request “readable” Italian paths for SEO.

**How to avoid:**
- Canonical English slugs: `/how-it-works`, `/privacy`, `/terms` (or `/legal/privacy` if grouping — but stay consistent).
- Italian only in visible text: “Come funziona”, “Privacy”, “Termini di servizio”.
- If Italian URLs are needed for campaigns, add **redirects only** in `next.config.ts` / `lib/routes.ts` — never primary routes.
- Extend `APP_ROUTES` (or new `PUBLIC_ROUTES` constant) with marketing paths; use constants in nav links, never string literals.

**Warning signs:**
- Mixed slug languages in sitemap.
- `check:language` flags route segments.
- Hardcoded `/come-funziona` in one component, `/how-it-works` in another.

**Phase to address:**
**Phase 2 — Public route group** (route naming): **Phase 3** (page implementation)

---

### Pitfall 6: Legal pages as placeholders — inaccurate GDPR / processor claims

**What goes wrong:**
Privacy and Termini ship with lorem ipsum or generic SaaS boilerplate that misstates: data stored in Supabase Postgres, files in Cloudflare R2, hosting on Vercel, auth via Better Auth, OAuth (Google/GitHub), optional Better Stack logging, no multi-tenant isolation, single-user personal finance scope.

**Why it happens:**
Legal pages are deferred “copy later”; engineering uses templates from unrelated products. Operator deploy (R038–R041) is pending, so exact vendor list feels fuzzy.

**How to avoid:**
- Treat Privacy/Termini as **accuracy-critical**, not cosmetic — wrong processor list is a compliance defect, not a polish item.
- Base content on actual stack from `CLAUDE.md` / deploy runbook; mark unknowns explicitly (“indirizzo titolare: TBD”) rather than inventing.
- No Pricing page (milestone constraint) — do not imply paid tiers or subscription terms that do not exist.
- Version legal docs with a “last updated” date; link from footer on all public pages.
- Optional: `robots` index for legal (usually fine to index); no personal data in static legal HTML.

**Warning signs:**
- Mentions Stripe, cookies not used, or “team accounts” contradicting product scope.
- No reference to bank import / CSV storage (R2).
- Copy pasted from US-centric template (CCPA sections with no Italian GDPR equivalent).

**Phase to address:**
**Phase 5 — Legal pages (Privacy & Termini)**

---

### Pitfall 7: Auth CTA flows inconsistent — sign-out, post-login, and marketing CTAs

**What goes wrong:**
- `signOutAction` redirects to `/login` — user expects the public homepage or brand story, not a form.
- Marketing CTAs deep-link to `/register` while nav says “Inizia gratis” → `/login`.
- OAuth return URLs ignore marketing origin; users land on dashboard with no way back to “Come funziona”.
- Authenticated users click “Registrati” on marketing (should hide or redirect).

**Why it happens:**
Auth actions were written for an app-only surface (`signInAction` → `/dashboard`, `signUpAction` → `/onboarding`, `signOutAction` → `/login`).

**How to avoid:**
- Audit all auth entry/exit points when adding marketing: `lib/actions/auth.ts`, OAuth callbacks, `(auth)` layout, marketing header CTAs.
- **Sign-out → `/`** (marketing home), not `/login`, unless product explicitly wants login wall.
- Marketing CTAs: primary → `/register`, secondary → `/login`; hide “Registrati” when session exists (lightweight session check in `PublicShell` only).
- Preserve existing `signUpAction` → `/onboarding` (avoids double redirect — comment in code documents this).
- Do not add `callbackUrl` complexity in v2.8 unless required — YAGNI.

**Warning signs:**
- Logout lands on login form with no brand context.
- “Entra” and “Registrati” both go to the same route.
- Authenticated session still shows registration CTAs on `/`.

**Phase to address:**
**Phase 4 — Smart root & auth CTA flows**

---

### Pitfall 8: Proto routes indexed or confused with production marketing

**What goes wrong:**
1. **SEO leak:** `/proto/*` or Preview-only variants get indexed (duplicate content, unfinished copy).
2. **Production confusion:** Stakeholders bookmark Preview proto URL; production 404 (`PROTOTYPES_ENABLED` unset) looks broken.
3. **Accidental carryover:** Production homepage copies proto’s `robots: noindex` or minimal layout without public nav/footer.

**Why it happens:**
`app/proto/layout.tsx` correctly sets `robots: { index: false }` and gates on `PROTOTYPES_ENABLED`, but `proxy.ts` treats **all** `/proto` as public even in Production (layout 404s, but crawlers/analytics still see the path). Proto is throwaway by design; marketing is permanent.

**How to avoid:**
- Keep proto **only** under `app/proto/` with existing env gate — never ship proto paths to production nav.
- Production marketing lives under `(public)/`, fully indexable (except if explicitly otherwise).
- When promoting design from proto → production, **port components**, not routes; delete proto variants per prior milestone convention (Phase 43/39 pattern).
- Verify Production: `/proto` → 404, `/` → 200 marketing.
- Do not add `/proto` to sitemap; do add `/`, `/how-it-works`, `/privacy`, `/terms`.

**Warning signs:**
- Google Search Console shows `/proto/overview`-style URLs (from older milestones).
- Production homepage has `noindex`.
- `PROTOTYPES_ENABLED` set in Production env by mistake.

**Phase to address:**
**Phase 1 — Proto variants & design lock** (proto discipline): **Phase 6 — SEO & launch hardening** (indexing)

---

### Pitfall 9: Server Actions broken by proxy redirects on new routes

**What goes wrong:**
Forms on marketing pages (newsletter, contact — if added) or mis-placed auth forms return opaque RSC errors because proxy redirected a `next-action` request.

**Why it happens:**
Middleware/proxy redirecting Server Action POSTs breaks the RSC action protocol (client expects RSC payload, gets 307).

**How to avoid:**
Sparter already handles this — `proxy.ts` passes through when `next-action` header is present. **Do not remove or reorder this block** when editing allowlists.
- Keep marketing pages free of Server Actions in v2.8 unless necessary; use links to `/login`/`/register`.
- If adding SA to public pages, verify the `next-action` bypass still runs before auth redirects.

**Warning signs:**
- “Failed to fetch” or RSC parse errors on form submit from public pages.
- Proxy refactor removes `next-action` early return.

**Phase to address:**
**Phase 2 — Public route group & proxy allowlist** (regression guard in tests)

---

## Moderate Pitfalls

### Pitfall 10: Onboarding gate accidentally applies to post-login marketing detour

**What goes wrong:**
Authenticated new user visits `/how-it-works` but route lives under `(app)` → onboarding redirect fires before content renders.

**Why it happens:**
Onboarding exemption list in `(app)/layout.tsx` is pathname-based (`/onboarding`, `/settings`, `/import`, `/tags`, `/patterns`). Marketing paths are not exempt — and should not be in `(app)` at all.

**Prevention:**
Keep marketing strictly outside `(app)`. If ever linking from onboarding to marketing, link to `(public)` routes only.

**Phase to address:** Phase 2

---

### Pitfall 11: Root metadata too generic for SEO and social sharing

**What goes wrong:**
All pages inherit `app/layout.tsx` metadata (`title: 'Sparter'`, generic description). Marketing homepage and “Come funziona” look identical in search results and unfurl previews.

**Prevention:**
- Per-page `metadata` or `generateMetadata` on public pages (Italian descriptions, Open Graph).
- Consider `metadataBase` once production URL is known (operator deploy R038).
- Legal pages: descriptive titles (“Privacy — Sparter”).

**Phase to address:** Phase 6 — SEO & launch hardening

---

### Pitfall 12: Duplicate public-route definitions drift from proxy

**What goes wrong:**
`PUBLIC_ROUTES` in `proxy.ts`, hrefs in components, and tests each maintain separate lists — new page ships, proxy not updated (back to Pitfall 1).

**Prevention:**
Export `isPublicPath(pathname)` from `lib/routes.ts`; unit test matrix shared by proxy tests and docs.

**Phase to address:** Phase 2

---

### Pitfall 13: `robots.txt` / `sitemap.xml` blocked or missing from matcher

**What goes wrong:**
Proxy matcher may run auth on `/robots.txt` or `/sitemap.xml` (currently matcher excludes api, static, png — **not** robots/sitemap). Crawlers get redirects or login HTML.

**Prevention:**
- Add `robots.txt` and `sitemap.xml` to public allowlist and/or matcher exclusion.
- Serve via `app/robots.ts` and `app/sitemap.ts` (App Router conventions).

**Phase to address:** Phase 6

---

## Minor Pitfalls

### Pitfall 14: Staging bypass (`STAGING_KEY`) masks public-route bugs

**What goes wrong:**
QA with `x-staging-key` bypasses all auth checks — public allowlist gaps go unnoticed.

**Prevention:**
Require incognito verification without staging header before merge.

**Phase to address:** Phase 6 (verification checklist)

---

### Pitfall 15: Pricing / tier marketing before product decision

**What goes wrong:**
Hero copy promises “Piano Pro” or pricing tables while milestone explicitly excludes Pricing page and offer is undefined (free/basic/pro gates exist in app, not in marketing).

**Prevention:**
Explain product value and categorization tiers qualitatively; link to app registration, not fictional pricing.

**Phase to address:** Phase 3 (copy review)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode public paths in `proxy.ts` only | Fastest ship | Drift, missed routes on every new page | Never — use shared module |
| Reuse `(auth)` layout for marketing | One less layout file | Wrong chrome, narrow column, no footer nav | Never |
| Copy proto page to `(public)/page.tsx` inline | Quick port | `noindex`, missing nav, throwaway structure baked in | Proto phase only |
| Placeholder legal HTML “to replace later” | Unblocks merge | Compliance gap if operator deploys before copy | Never for Production — ship accurate minimal copy or block deploy |
| Italian URL slugs | Stakeholder-friendly links | Violates convention, redirect debt | Only as redirects from English canonical |
| Skip proxy tests (“works logged in”) | Saves 30 minutes | Production anon broken | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `proxy.ts` + Better Auth session | Broadening “public” by negation (`!protected`) without listing marketing prefixes | Explicit allowlist imported from `lib/routes.ts` |
| `(app)/layout.tsx` onboarding gate | Assuming marketing can live in `(app)` with exemption | Separate `(public)` group — no gate |
| `app/proto/` env gate | Treating proto as production marketing fallback | Proto Preview-only; production `(public)` |
| `signOutAction` / OAuth | Leaving redirect targets app-only (`/login`) | Sign-out → `/`; keep sign-up → `/onboarding` |
| Vercel Preview vs Production | `PROTOTYPES_ENABLED` scoped wrong — proto visible in prod or marketing 404 in preview | Proto env Preview-only; public routes always on |
| Root `ThemeProvider` | Duplicating providers in public layout | Single root provider; public layout only adds chrome |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Session fetch on every marketing page | TTFB ↑, edge/Node auth on static content | Static/ISR for `(public)` pages; session only on smart root if needed | First Lighthouse audit on `/` |
| Proxy auth on static assets | Slow CSS/font loads; spurious redirects | Keep existing matcher exclusions; add robots/sitemap | High traffic marketing launch |
| Heavy recharts/dashboard components imported in public bundle | Large JS on homepage | No imports from `(app)/dashboard` into `(public)` | Build analyze / bundle checker |
| `force-dynamic` on marketing | No caching, cold starts on Vercel | Default static; dynamic only where session-aware root requires | Scale irrelevant for Sparter — still hurts UX |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Marketing routes skip proxy allowlist update | Unintended public access to `(app)` routes if mis-filed | Deny-by-default proxy; test anon access per route |
| Trust client-supplied `x-pathname` | Onboarding bypass / gate confusion | Proxy overwrites header (already done — preserve on refactor) |
| Legal pages claim encryption/security not implemented | Misleading users/regulators | Accurate minimal claims; “in transit via HTTPS” only |
| Proto enabled in Production | Unfinished UX public, possible stakeholder data in mock | `PROTOTYPES_ENABLED` unset in Production; verify 404 |
| Public contact form without rate limit (if added) | Spam/abuse | Out of v2.8 scope — use mailto: or defer |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Anon `/` → login wall | Cannot learn about product | Public homepage with clear value prop |
| Logout → bare login | Disorienting; feels like session error | Logout → branded homepage |
| Auth user sees “Registrati” | Confusing duplicate account CTA | Session-aware header: “Vai all’app” |
| Marketing in app shell | Feels like broken dashboard | Dedicated public layout |
| English URLs, Italian 404 messages | Trust friction | Italian UI error copy; English routes |
| “Come funziona” promises features not shipped | Disappointment at registration | Copy aligned with validated capabilities only |

## "Looks Done But Isn't" Checklist

- [ ] **Public homepage:** Renders in incognito without 307 — verify Network tab on `/`
- [ ] **Proxy allowlist:** Every `(public)` path in shared constant + automated test
- [ ] **Smart root:** Auth `/` → dashboard (or onboarding if 0 tx); anon `/` → marketing
- [ ] **Layout isolation:** No `AppShell` / sidebar / bottom nav on public pages
- [ ] **Route slugs:** English paths; Italian visible labels only; `yarn check:language` clean
- [ ] **Legal pages:** Processor list matches Supabase + R2 + Vercel + Better Auth; no Pricing claims
- [ ] **Auth CTAs:** Sign-out → `/`; marketing buttons → `/register` & `/login`; no dupes when logged in
- [ ] **Proto discipline:** Production `/proto` 404; production `/` indexable; proto not in sitemap
- [ ] **SEO:** Page-specific metadata; `robots.ts` / `sitemap.ts` reachable without auth redirect
- [ ] **Server Actions:** `next-action` bypass intact after proxy edits

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Allowlist gap (anon → login) | LOW | Add paths to shared public list; hotfix deploy |
| Redirect loop on `/` | MEDIUM | Identify competing redirects in page vs proxy vs layout; consolidate smart root |
| Marketing under `(app)` | MEDIUM | Move routes to `(public)`; revert layout imports |
| Indexed proto URLs | LOW–MEDIUM | `noindex` (already on proto); GSC removal request; ensure prod marketing canonical |
| Wrong legal copy live | MEDIUM | Patch content; update “last modified”; avoid downplaying if users already read |
| Sign-out to wrong place | LOW | Change `signOutAction` redirect; no migration |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Proxy allowlist gaps | Phase 2 — Public route group & proxy | Incognito curl/UI; proxy unit tests return 200 |
| Smart root loops / dead ends | Phase 4 — Smart root & auth CTAs | Matrix test anon/auth/0-tx; no double 307 |
| `(app)` layout / onboarding leak | Phase 2 — Public route group | No `verifySession` in `(public)` layout stack |
| Marketing vs app chrome mix | Phase 2 + Phase 3 | Visual QA: no sidebar/bottom nav on `/` |
| Italian slugs vs English routes | Phase 2 — Route naming | `yarn check:language`; grep for Italian path segments |
| Legal inaccuracy | Phase 5 — Legal pages | Checklist vs deploy runbook vendors |
| Auth CTA / sign-out flows | Phase 4 — Smart root & auth CTAs | Manual logout + CTA click paths |
| Proto indexing / confusion | Phase 1 + Phase 6 | Prod `/proto` 404; Search Console clean |
| Server Action + proxy | Phase 2 — Proxy refactor guard | SA submit from public page if any; preserve bypass |
| SEO metadata / sitemap | Phase 6 — SEO & launch hardening | OG debugger; fetch `/robots.txt` unauthenticated |

### Suggested v2.8 phase order (pitfall-driven)

1. **Phase 1 — Proto variants & design lock** — Pitfalls 8, 15 (design only, no production routes)
2. **Phase 2 — `(public)` route group + proxy allowlist** — Pitfalls 1, 3, 9, 12, 13 (foundation)
3. **Phase 3 — Homepage & Come funziona** — Pitfalls 4, 5, 15 (content + `PublicShell`)
4. **Phase 4 — Smart root & auth CTAs** — Pitfalls 2, 7, 10 (routing + auth exits)
5. **Phase 5 — Privacy & Termini** — Pitfall 6 (legal accuracy)
6. **Phase 6 — SEO & launch hardening** — Pitfalls 8, 11, 13, 14 (metadata, robots, sitemap, checklists)

## Sources

- Sparter `proxy.ts` — deny-by-default auth, `/proto` public bypass, `next-action` pass-through, matcher config
- Sparter `app/(app)/layout.tsx` — onboarding gate, `AppShell` chrome, `x-pathname` exemptions
- Sparter `app/page.tsx` — unconditional `/dashboard` redirect (must change for v2.8)
- Sparter `app/proto/layout.tsx` — `PROTOTYPES_ENABLED` gate, `robots: noindex`
- Sparter `lib/actions/auth.ts` — sign-in/up/out redirect targets
- Sparter `.planning/PROJECT.md` — v2.8 milestone scope, English slug convention, no Pricing
- Sparter `CLAUDE.md` — proto vs production deploy rules, language convention
- Industry: Authgear Next.js middleware guide — redirect loops, matcher scope (MEDIUM confidence)
- Industry: GuardLayer / TheCodeForge — matcher performance and static asset exclusion (MEDIUM confidence)

---
*Pitfalls research for: Sparter v2.9 — Public Branding Site*
*Researched: 2026-07-22*
