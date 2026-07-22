# Requirements: Sparter — Active: v2.8 Public Branding Site

**Defined:** 2026-07-22
**Core Value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending.
**Active milestone goal:** Ship a public branding façade on the same Next.js deploy that explains Sparter and links into the app, with design locked via `app/proto/` variants first.
**Previous milestone:** v2.7 Tag Dedicated View shipped 2026-07-22 (phases 69–72 on main).

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

## v2.8 Future Requirements

Deferred beyond v2.8 soft go-live.

- **BRAND-F01**: Pricing page when commercial offer is defined
- **BRAND-F02**: Full Informazioni legali page when formal business entity (P.IVA) exists
- **BRAND-F03**: Analytics + consent/CMP when third-party tracking is legally reviewed
- **BRAND-F04**: Blog / newsletter / contact form
- **BRAND-F05**: English locale / i18n for public site
- **BRAND-F06**: Product demo / sandbox without registration
- **BRAND-F07**: Optional `motion` scroll storytelling if a future redesign needs it beyond CSS

## v2.7 Requirements (shipped 2026-07-22)

REQ-IDs continue the `TAG` category from v2.6 (TAG-01…TAG-05 shipped earlier).

### Tag Dedicated View

- [x] **TAG-06**: User can open a dedicated page for a single tag showing its all-time overview (every transaction carrying the tag, independent of any calendar period).
- [x] **TAG-07**: The tag page shows three totals — Entrate, Uscite, and Valore finale (signed net) — computed with the same netting/exclusions as the dashboard (`getTagDetail`/`getTagTotals`), so the numbers reconcile with `/dashboard/tags`.
- [x] **TAG-08**: The tag page shows the number of included transactions (matching the totals' transaction set).
- [x] **TAG-09**: The tag page shows a per-category breakdown of the tag's transactions with signed amounts.
- [x] **TAG-10**: The tag page shows a compact list of the included transactions (date · description · subcategory · signed amount), sorted by date descending.
- [x] **TAG-11**: User can edit and archive the tag directly from the dedicated page.
- [x] **TAG-12**: User can reach the tag page from `/tags` and from `/dashboard/tags`.

### Dashboard Tag-Filter Removal

- [x] **TAG-13**: The dashboard no longer offers a period-scoped tag filter — `?tag=` is removed from `/dashboard/overview` and `/dashboard/categories` (including `TagFilterSelect`, `tagId` threading through the overview/category DAL, the `no-data-for-tag` empty state, and `parseTagIdParam`). Per-tag analysis lives only in the dedicated all-time page.

### Transactions Tag Filter

- [x] **TAG-14**: User can filter the transactions table by tag from the transactions toolbar — a tag control integrated into the existing unified filter/sort system (writes `?tag=`, persisted, shown as an active chip, cleared by clear-all). The `?tag=` URL param, ownership guard, and `getTransactions` `tagId` support already exist; this adds the UI control.

### Transactions Tag Indicator

- [x] **TAG-15**: In the transactions list, a transaction that carries tags shows an inline tag chip on the same line as its title — after the ellipsis when the title is truncated — and hovering or tapping the chip reveals a small popover listing the linked tags.

### v2.7 deferred

- **TAG-F1**: Per-tag trend/sparkline over the tag's active span.
- **TAG-F2**: Export a tag's transactions (CSV) from the dedicated page.

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
| Period-scoped per-tag analysis in the dashboard | Replaced by all-time dedicated page (v2.7 / TAG-06) |
| `dateRange` as a hard filter on the tag's transactions | Descriptive label only (v2.7) |
| New tag CRUD semantics | Create/edit/archive already shipped in v2.6 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRAND-01 | 73. proto-design-variants | Complete |
| BRAND-02 | 73. proto-design-variants | Complete |
| BRAND-03 | 74. public-layout-and-proxy-allowlist | Pending |
| BRAND-04 | 74. public-layout-and-proxy-allowlist | Pending |
| BRAND-05 | 74. public-layout-and-proxy-allowlist | Pending |
| BRAND-06 | 75. marketing-pages | Pending |
| BRAND-07 | 75. marketing-pages | Pending |
| BRAND-08 | 75. marketing-pages | Pending |
| BRAND-09 | 76. legal-pages | Pending |
| BRAND-10 | 76. legal-pages | Pending |
| BRAND-11 | 77. seo-and-auth-polish | Pending |
| BRAND-12 | 77. seo-and-auth-polish | Pending |
| BRAND-13 | 77. seo-and-auth-polish | Pending |
| TAG-06…TAG-12 | 69. tag-dedicated-page | Complete |
| TAG-13 | 70. dashboard-tag-filter-removal | Complete |
| TAG-14 | 71. transactions-tag-filter-control | Complete |
| TAG-15 | 72. transactions-tag-indicator | Complete |

**Coverage:**

- v2.8 requirements: 13 total — 2 complete, 11 pending
- v2.7 requirements: TAG-06…TAG-15 complete

---
*Requirements defined: 2026-07-22*
*Last updated: 2026-07-22 — merge origin/main (v2.7) + local branding renumber to phases 73–77*
