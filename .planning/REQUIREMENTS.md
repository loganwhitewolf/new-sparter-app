# Requirements: Sparter v2.8 — Public Branding Site

**Defined:** 2026-07-22
**Core Value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending.
**Milestone goal:** Ship a public branding façade on the same Next.js deploy that explains Sparter and links into the app, with design locked via `app/proto/` variants first.

## v2.8 Requirements

### Design (proto)

- [x] **BRAND-01**: Visitor on Vercel Preview can compare 2–3 branding UI variants under `app/proto/` (throwaway, `noindex`, `PROTOTYPES_ENABLED`-gated)
- [x] **BRAND-02**: One proto variant is selected as the production design direction before shipping `(public)` page UI

### Infrastructure

- [ ] **BRAND-03**: Anonymous visitor sees marketing pages under a dedicated `(public)` layout (header/nav/footer) without AppShell, sidebar, or onboarding gate
- [ ] **BRAND-04**: Public marketing paths are allowlisted in `proxy.ts` via a single source of truth in `lib/routes.ts` (anon access without 307 to `/login`)
- [ ] **BRAND-05**: Smart root — unauthenticated `/` serves the marketing homepage; authenticated `/` redirects to `/dashboard`

### Marketing pages

- [ ] **BRAND-06**: Anonymous visitor on `/` sees an Italian homepage (hero, import-first value prop, product visual, primary CTA Registrati, secondary Entra), mobile-responsive
- [ ] **BRAND-07**: Visitor can open `/how-it-works` (“Come funziona”) with 3–5 steps aligned to the real import → categorize → dashboard/deviations flow
- [ ] **BRAND-08**: Public nav and footer link to how-it-works, Privacy, Termini, Entra, and Registrati (no Pricing link)

### Legal

- [ ] **BRAND-09**: Visitor can open `/privacy` with GDPR-minimum policy covering real sub-processors (Vercel, Supabase, R2, Better Auth / OAuth); footer-linked on every public page
- [ ] **BRAND-10**: Visitor can open `/terms` with usage terms (no financial advice, as-is service, no pricing/payment clauses); footer-linked

### SEO & auth polish

- [ ] **BRAND-11**: Each public production page has Italian SEO metadata; `app/sitemap.ts` and `app/robots.ts` list indexable public routes; `app/proto/*` remains `noindex`
- [ ] **BRAND-12**: Public header is session-aware (hides Registrati when authenticated); CTAs navigate to existing `/login` and `/register`
- [ ] **BRAND-13**: After sign-out, user lands on `/` (marketing homepage), not `/login`

## Future Requirements

Deferred beyond v2.8 soft go-live.

- **BRAND-F01**: Pricing page when commercial offer is defined
- **BRAND-F02**: Full Informazioni legali page when formal business entity (P.IVA) exists
- **BRAND-F03**: Analytics + consent/CMP when third-party tracking is legally reviewed
- **BRAND-F04**: Blog / newsletter / contact form
- **BRAND-F05**: English locale / i18n for public site
- **BRAND-F06**: Product demo / sandbox without registration
- **BRAND-F07**: Optional `motion` scroll storytelling if a future redesign needs it beyond CSS

## Out of Scope

| Feature | Reason |
|---------|--------|
| Pricing page | Offer undefined (locked) |
| Bank account linking / “collega la banca” | Product is import-first by design |
| Fake social proof / fabricated user counts | Soft go-live; trust risk for finance |
| Separate marketing domain or CMS | Same Next.js deploy; two static docs don't justify CMS |
| Cookie banner without trackers | No third-party analytics in v2.8 |
| Italian URL slugs (`/come-funziona`, `/termini`) | AGENTS.md: English route slugs; Italian in UI copy only |
| Operator Vercel/Supabase/R2 go-live (R038/R039/R041) | Operational action; not this milestone's build scope |
| v2.7 tags work | Parallel milestone owned by other agent |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRAND-01 | 69. proto-design-variants | Complete |
| BRAND-02 | 69. proto-design-variants | Complete |
| BRAND-03 | 70. public-layout-and-proxy-allowlist | Pending |
| BRAND-04 | 70. public-layout-and-proxy-allowlist | Pending |
| BRAND-05 | 70. public-layout-and-proxy-allowlist | Pending |
| BRAND-06 | 71. marketing-pages | Pending |
| BRAND-07 | 71. marketing-pages | Pending |
| BRAND-08 | 71. marketing-pages | Pending |
| BRAND-09 | 72. legal-pages | Pending |
| BRAND-10 | 72. legal-pages | Pending |
| BRAND-11 | 73. seo-and-auth-polish | Pending |
| BRAND-12 | 73. seo-and-auth-polish | Pending |
| BRAND-13 | 73. seo-and-auth-polish | Pending |

**Coverage:**

- v2.8 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-07-22*
*Last updated: 2026-07-22 after v2.8 roadmap creation — 13/13 requirements mapped across Phases 69–73 (proto first, proxy allowlist precedes production pages)*
