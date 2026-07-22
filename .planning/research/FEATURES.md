# Feature Research

**Domain:** Public branding / marketing site for Italian personal-finance SaaS (Sparter v2.8)
**Researched:** 2026-07-22
**Confidence:** HIGH (SaaS marketing patterns well-established; Italian legal baseline MEDIUM — operator/legal review still required for final copy)

## Feature Landscape

### Table Stakes (Users Expect These)

Features visitors assume exist on any credible product site. Missing these makes Sparter feel like an internal tool or unfinished product — especially for a finance app where trust is non-negotiable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Homepage `/` with hero + value proposition** | First touchpoint; must answer "cos'è?" and "a chi serve?" in <5 seconds | MEDIUM | Hero: outcome headline (import → categorizza → capisci dove va il denaro), subheadline, primary CTA, product visual (real dashboard screenshot). Pattern: hero → 2–3 benefit blocks → closing CTA. Italian copy. **Depends on:** `(public)` layout, design locked via `app/proto/` |
| **Primary CTA → auth (`Entra` / `Registrati`)** | Self-serve SaaS standard: one dominant action, repeated at hero + nav + footer | LOW | Link to existing `/login` and `/register` (Better Auth + OAuth already built). Primary = `Registrati`, secondary ghost = `Entra`. Authenticated users on auth routes already redirect to `/dashboard` (proxy.ts). Avoid competing CTAs of equal weight |
| **Dedicated public layout** | Marketing pages must not inherit app shell (sidebar, onboarding gate, BottomNav) | MEDIUM | New route group `(public)` with minimal header/footer, no `verifySession` / txCount gate. Distinct from `(auth)` centered card layout and `(app)` AppShell. Reuse Tailwind + shadcn tokens for brand consistency |
| **Smart root routing** | `/` today redirects all visitors to `/dashboard` → anon users bounce to `/login` (broken first impression) | LOW–MEDIUM | **Anon → marketing homepage; auth → `/dashboard`.** Implement via RSC in `app/page.tsx` (session read in Node) or proxy allowlist expansion. **Depends on:** session helper already used in proxy (`getAuthSessionOrNull`). Do not run Drizzle onboarding gate on public routes |
| **"Come funziona" page** | Visitors evaluating a finance tool need a scannable explanation before signup; standard nav item in Italian fintech (Moneyfarm, Copilot, YNAB all explain the flow) | MEDIUM | 3–5 steps aligned with real product flow: carica estratto → categorizza → dashboard/deviazioni. Use icons + short copy; optional screenshot per step. Route e.g. `/come-funziona` (Italian slug for product surface). Link from nav + homepage |
| **Privacy policy (`/privacy`)** | GDPR Art. 13–14; finance apps face higher scrutiny; required link near signup and in footer | MEDIUM (content) / LOW (page) | Static MDX or RSC page. Must cover: titolare, finalità (account, import file, categorization), base giuridica, sub-processors (Vercel, Supabase, R2), retention, diritti interessato, DPO/contact. **Not a code feature — legal copy required.** Footer link on every public page |
| **Terms of service (`/termini`)** | Sets usage rules, liability limits, acceptable use; expected pair with Privacy for any signup product | MEDIUM (content) / LOW (page) | Static page: account terms, no financial advice disclaimer, service "as-is", termination, governing law. No pricing/payment clauses until offer exists. Footer link |
| **Public footer with legal + auth links** | Universal SaaS convention; only persistent navigation on legal pages | LOW | Logo/wordmark, `Come funziona`, `Privacy`, `Termini`, `Entra`, `Registrati`. No pricing link (explicitly out of scope). Optional: copyright line |
| **Top navigation (logo, 1–2 links, CTA button)** | Evaluation-mode visitors scan nav for product explanation and signup | LOW | Max 3–4 items: `Come funziona`, `Entra`, `Registrati` (filled). Sticky nav with persistent CTA is table stakes for conversion-oriented SaaS — implement if proto direction allows without clutter |
| **Mobile-responsive layout** | Majority of Italian traffic is mobile; broken mobile = instant bounce | LOW | Tailwind responsive patterns; test hero + nav collapse. `(auth)` layout already mobile-friendly — public layout should match |
| **Basic SEO metadata** | Homepage is indexable once public; needs title + description for search/social sharing | LOW | `metadata` export per page: `Sparter — Finanza personale`, Italian description mentioning import + categorizzazione. `robots: index` on production public pages (contrast: `app/proto/` is `noindex`) |
| **proxy.ts public route allowlist** | Today only `/login`, `/register`, `/proto/*` are public; marketing routes would 307 to `/login` | LOW | Extend `PUBLIC_ROUTES` or prefix match for `(public)` paths (`/`, `/come-funziona`, `/privacy`, `/termini`). Must not break Server Actions (existing `next-action` bypass). **Blocks all public pages until done** |

### Differentiators (Competitive Advantage)

Not required for soft go-live, but these align with Sparter's **Core Value** (import → categorize → spot deviations) and distinguish from bank-sync-first competitors (Monarch, Copilot) and investment-first Italian sites (Moneyfarm).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Import-first positioning ("I tuoi estratti, le tue regole")** | No PSD2/bank credentials — appeals to privacy-conscious Italians and multi-bank users who export CSV/PDF | LOW (copy) | Hero/subhead stress file upload, not "collega la banca". Honest: data reflects last import, not live sync (matches CONTEXT.md). Differentiates from Mint-successors |
| **Deviation / baseline narrative** | "Dove spendi di più rispetto alla tua media" is Sparter's insight hook — rare in marketing copy, common in product | MEDIUM | One homepage section or Come funziona step showing deviation badges / movers panel screenshot. Uses real app UI — high trust vs abstract illustrations |
| **Italian bank ecosystem credibility** | Naming Intesa, Revolut, Fineco, Trade Republic (already in seed) signals "fatto per l'Italia" | LOW | Logo strip or text list on homepage — **only banks/formats actually supported**. No fake "500+ banche" claims |
| **3-tier categorization story (regex → storico → AI)** | Shows depth without requiring signup; educates on free/basic/pro gating | MEDIUM | Come funziona section: automatico con regex, impara dalle tue scelte, AI (Pro). Avoid over-promising AI tier if not marketed yet |
| **Product screenshots from real app** | Finance buyers distrust stock art; Copilot/YNAB lead with actual UI | LOW–MEDIUM | Reuse `/dashboard/overview` capture (grouped chart, KPI cards, filter chips). Dark/light aware. Requires proto → production design pass |
| **Guided onboarding promise** | Reduces signup fear ("non devo capire tutto subito") | LOW | One line + link to Come funziona: 5-step first-import flow already shipped. CTA still goes to register, not a demo |
| **Privacy-by-architecture message** | File → R2 presigned upload; no proxy of bank credentials through server | LOW | Short trust line near CTA: "Nessun accesso al tuo home banking — carichi solo i file che scegli tu." Factually accurate per architecture |
| **Proto-driven design selection (`app/proto/`)** | 2–3 throwaway variants before production reduces rework; stakeholder-ready previews on Vercel Preview | MEDIUM | Already have `app/proto/layout.tsx` with `PROTOTYPES_ENABLED` gate + `noindex`. Phase 1 of milestone — not user-facing in production |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem necessary but conflict with locked v2.8 scope, soft go-live goals, or Sparter constraints.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Pricing page** | Every SaaS template includes pricing teaser + `/pricing` | Offer/tiers not defined; subscription gates exist in app but public pricing creates commitment before business decision | Omit entirely (locked). Homepage CTA → free signup. Revisit when plans are marketed |
| **Bank account linking / "collega la banca"** | Table stakes for Monarch/Copilot/Mint | Sparter is import-based by design; promising sync misleads users and sets wrong expectations | Copy: "Importa estratti CSV, Excel e PDF" — list supported platforms |
| **Fake social proof** | SaaS playbooks demand logo bars, testimonials, "10.000+ utenti" | Soft go-live has no user base; fabricated proof damages trust in finance | Omit or replace with factual product claims (banks supported, features shipped). Add real testimonials when available |
| **Contact form / lead capture** | "Talk to us" for enterprise SaaS | Adds GDPR consent UX, spam, PEC obligations; single-user product doesn't need sales pipeline | `Registrati` is the conversion path; support email in Privacy if needed |
| **Blog / content hub** | SEO long-term play | Scope explosion; no content ops; distracts from shipping pages | Single Come funziona page covers education need for v2.8 |
| **Newsletter signup** | Marketing list building | GDPR consent + double opt-in + copy; no email marketing strategy yet | Skip |
| **Analytics/marketing pixels (GA4, Meta Pixel) pre-consent** | "Measure conversions" | Italian GDPR 2026 enforcement: non-essential cookies blocked until explicit consent; dark-pattern banners risky | Ship with zero third-party trackers initially, or Consent Mode v2 + proper banner as separate phase |
| **Cookie banner without legal review** | "GDPR checkbox" mentality | Incomplete banner (Accept-only, pre-loaded trackers) is worse than none for soft go-live | If no analytics cookies, technical cookies only → minimal/no banner; add proper CMP when tracking added |
| **Separate marketing domain** | `sparter.it` vs `app.sparter.it` | Extra DNS, cookies, CORS, auth cookie domain complexity | Same Next.js deploy, same origin — `(public)` + `(app)` route groups (locked architecture) |
| **Demo / sandbox account** | "Try before signup" | Auth + empty DB + onboarding gate complexity; no guest mode exists | Free registration (guardrail already removed per v1.9) + onboarding flow IS the trial |
| **App Store / Play Store badges** | Credibility signal | No mobile app (out of scope per PROJECT.md) | Web-only badge or "Disponibile sul web" |
| **English locale / i18n** | Broader market | Locked: Italian product surfaces; developer code stays English | Italian only for v2.8 public pages |
| **Live chat widget** | Support accessibility | Cost, privacy policy updates, staffing | Deferred |
| **FAQ page (large)** | Reduces pre-signup objections | Overlap with Come funziona; maintenance burden | 3–5 inline FAQ accordion on homepage optional P2; not standalone page for v2.8 |
| **Comparison pages ("Sparter vs YNAB")** | SEO + differentiation | Legal/reputational risk; invites feature parity arguments | Differentiate in copy, not attack pages |
| **Video hero / product tour** | High-converting SaaS pattern | Production cost, hosting, accessibility | Static screenshots first; video later if validated |
| **Informazioni legali as full standalone page** | Italian consumer/e-commerce law | Soft go-live may lack formal company entity (personal deploy); premature P.IVA/REA blocks launch | **Minimum:** Privacy identifies data controller (even if individual). **Defer** full Informazioni legali until business entity exists; note as pre-production checklist item |

## Feature Dependencies

```
app/proto/ variants (Phase 1)
    └──requires──> Design direction pick
                       └──requires──> (public) layout + components
                                          └──requires──> Homepage /
                                          └──requires──> Come funziona
                                          └──requires──> Privacy + Termini

proxy.ts PUBLIC_ROUTES expansion
    └──requires──> All public routes defined
    └──blocks──> Any anon visitor reaching marketing pages

Smart root (app/page.tsx)
    └──requires──> Session read (getAuthSessionOrNull / verifySession)
    └──requires──> Marketing homepage exists OR temp placeholder
    └──conflicts──> Current redirect('/dashboard') for all users

CTA → /login, /register
    └──requires──> Existing Better Auth routes (built)
    └──enhances──> OAuth providers (env-conditional, built)

Privacy + Termini content
    └──requires──> Legal copy (operator/legal, not engineering)
    └──enhances──> Footer on all public pages

SEO metadata
    └──enhances──> Homepage, Come funziona
    └──conflicts──> app/proto/ noindex (intentional — proto stays non-indexed)
```

### Dependency Notes

- **`proxy.ts` blocks everything public:** Until marketing paths are allowlisted, anon users hitting `/` get redirected to `/login` after the current root redirect chain. This is the first infrastructure dependency.
- **Smart root depends on homepage existing:** `app/page.tsx` can branch on session, but the anon branch needs the marketing page — likely colocated or under `(public)` with route group layout.
- **Onboarding gate must not wrap public routes:** `(app)/layout.tsx` runs `verifySession` + txCount check. Public pages must live outside `(app)` to avoid forcing login/onboarding.
- **Proto variants are upstream of production UI:** Locked milestone flow: 2–3 proto pages → pick direction → implement production `(public)` pages. Proto uses `PROTOTYPES_ENABLED` + `noindex`; production public pages are indexable.
- **Legal pages are content-gated, not code-gated:** Engineering can ship placeholder routes; soft go-live should not publish without real Privacy/Termini text reviewed for Supabase/R2/Vercel sub-processors.
- **No Pricing avoids coupling to subscription system:** In-app tier gating (free/basic/pro) exists but public marketing must not reference prices until offer is defined.

## MVP Definition

### Launch With (v2.8 soft go-live)

Minimum for a credible public façade that explains Sparter and funnels to signup.

- [ ] **Proto variants (2–3)** — Design lock before production implementation (locked Phase 1)
- [ ] **Homepage `/`** — Hero, product explanation, import-first value prop, CTAs Entra/Registrati, footer
- [ ] **Come funziona** — 3–5 step flow matching real import → categorize → dashboard journey
- [ ] **Privacy + Termini** — GDPR-minimum static pages, footer-linked
- [ ] **Smart root** — Anon → marketing; auth → `/dashboard`
- [ ] **Dedicated `(public)` layout** — Header/nav/footer, no app shell
- [ ] **proxy.ts allowlist** — Public routes accessible without session

### Add After Validation (post soft go-live)

- [ ] **Inline FAQ (3–5 items)** — When support questions repeat (import formats, data privacy, pricing timing)
- [ ] **Informazioni legali page** — When formal business entity (P.IVA, sede legale) exists
- [ ] **Cookie consent + analytics** — When conversion tracking is needed and legally reviewed
- [ ] **Open Graph / social cards** — When sharing links matters (og:image with branded screenshot)
- [ ] **Testimonials / user quotes** — When real users consent to publish

### Future Consideration (v2.9+)

- [ ] **Pricing page** — When subscription offer is defined and stable
- [ ] **Blog / guide content** — SEO for "come importare estratto conto Fineco" etc.
- [ ] **Changelog / What's new** — When release cadence is public-facing
- [ ] **Status page link** — When `/api/health` becomes a public status surface
- [ ] **Localized EN marketing** — If market expands beyond Italy

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| proxy.ts public allowlist | HIGH (blocker) | LOW | P1 |
| Smart root routing | HIGH | LOW | P1 |
| `(public)` layout | HIGH | MEDIUM | P1 |
| Homepage hero + CTAs | HIGH | MEDIUM | P1 |
| Come funziona page | HIGH | MEDIUM | P1 |
| Privacy + Termini pages | HIGH (trust/legal) | MEDIUM (content) | P1 |
| Public footer + nav | HIGH | LOW | P1 |
| SEO metadata | MEDIUM | LOW | P1 |
| Proto UI variants | MEDIUM (process) | MEDIUM | P1 (Phase 1) |
| Product screenshots in marketing | MEDIUM | LOW | P2 |
| Deviation/import differentiator copy | MEDIUM | LOW | P2 |
| Sticky nav with CTA | MEDIUM | LOW | P2 |
| Supported banks logo strip | MEDIUM | LOW | P2 |
| Inline FAQ accordion | LOW | LOW | P3 |
| Open Graph images | LOW | LOW | P3 |
| Cookie banner + analytics | LOW (until tracking) | MEDIUM | P3 |

**Priority key:**
- P1: Must have for v2.8 soft go-live
- P2: Should have if time allows in milestone
- P3: Defer post go-live

## Competitor Feature Analysis

| Feature | Moneyfarm (IT) | Copilot Money (US) | Monarch / YNAB | Sparter v2.8 Approach |
|---------|----------------|--------------------|--------------------|------------------------|
| Primary CTA | Apri conto / Inizia | Start trial ($95/yr) | Free trial / Sign up | **Registrati** (free signup, no card) |
| Value prop focus | Investimenti + consulenza | AI categorization + net worth | Budget / all-in-one dashboard | **Import estratti → categorizza → deviazioni** |
| How it works | Product pages per linea | Feature sections on homepage | Help center + marketing steps | **Dedicated `/come-funziona`** (3–5 steps) |
| Pricing on site | Transparent (investment fees) | $95/yr on homepage | Tier pricing | **Omit** (locked) |
| Bank linking story | Sì (broker) | Plaid sync (10k+ institutions) | Plaid / sync | **Anti-feature** — file import only |
| Legal pages | Footer: privacy, note legali | Privacy in footer | Privacy + terms | **Privacy + Termini** (minimal) |
| Social proof | Awards, Poste/Allianz investors | App Store reviews, MKBHD | User counts, Mint migration | **Omit fakes** for soft go-live |
| Product visuals | App screenshots | Real UI screenshots | Real UI | **Real dashboard screenshots** |
| Language | Italian | English | English | **Italian** product copy |

## Expected Page Behaviors (Reference)

How each page should behave for anon vs authenticated users — informs routing and QA.

| Route | Anon visitor | Authenticated user |
|-------|--------------|-------------------|
| `/` | Marketing homepage | Redirect → `/dashboard` |
| `/come-funziona` | Static explainer | Same (optional: nav shows "Dashboard" instead of Entra) |
| `/privacy`, `/termini` | Static legal | Same |
| `/login`, `/register` | Auth forms | Redirect → `/dashboard` (existing) |
| `/dashboard/*` | Redirect → `/login` (existing) | App shell + onboarding gate (existing) |
| `/proto/*` | Proto demos (Preview env only) | Same (no auth required) |

**CTA behavior:** All `Registrati` → `/register`; all `Entra` → `/login`. No embedded signup forms on marketing pages (keeps auth in `(auth)` layout, single validation path).

## Sources

- Sparter `.planning/PROJECT.md` — v2.8 locked scope, architecture, out-of-scope items
- Sparter `CONTEXT.md` — domain language for Come funziona copy (Import, Deviation, FlowNature)
- Sparter `proxy.ts`, `app/page.tsx`, `app/proto/layout.tsx` — current routing/auth behavior
- SaaS homepage conversion patterns (hero → proof → features → CTA repetition): Canvas Builder, MRR Unlocked, Vezert, Brand Vision — 2025–2026 guides
- Italian GDPR web obligations (privacy footer, cookie consent, no pre-consent tracking): WebNovis GDPR guide 2026, Clym Informazioni legali glossary
- Competitor public sites: Moneyfarm IT, Copilot Money, Monarch/YNAB positioning (NerdWallet, WalletGrower comparisons)
- Personal-finance marketing conventions: import-first tools (YNAB file-based, Monarch CSV) vs sync-first (Copilot, Monarch default)

---
*Feature research for: Sparter v2.8 — Public Branding Site*
*Researched: 2026-07-22*
