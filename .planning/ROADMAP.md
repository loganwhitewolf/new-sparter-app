# Roadmap

## Milestones

- ✅ **M001–M006** — Foundation → Dashboard Insight Suite (Phases 1–23, shipped ~2026-05)
- ✅ **M007: Zero-cost Production Deploy** — Phases 24–28 (shipped 2026-05-19)
- ✅ **v1.8 / M008: Dashboard Intelligence** — Phase 29 (shipped 2026-05-20)
- 🚧 **v1.9: Social Auth** — Phases 30–32 (in progress)

## Phases

<details>
<summary>✅ M001–M006 (Phases 1–23) — SHIPPED</summary>

- [x] Phase 01: design-system
- [x] Phase 02: authentication
- [x] Phase 03: expense-management
- [x] Phase 04: dashboard-kpi
- [x] Phase 05–07: M001 remaining slices
- [x] Phase 08–10: M002 Observability
- [x] Phase 11–16: M004 Import Management
- [x] Phase 17–20: M005 Category Management & UX Polish
- [x] Phase 21–23: M006 Dashboard Insight Suite

</details>

<details>
<summary>✅ M007: Zero-cost Production Deploy (Phases 24–28) — SHIPPED 2026-05-19</summary>

- [x] Phase 24: s01 — env contract + DB pool config
- [x] Phase 25: s02 — production migration CLI
- [x] Phase 26: s03 — R2 upload + CORS
- [x] Phase 27: s04 — registration guardrail
- [x] Phase 28: s05 — runbook + smoke suite

</details>

<details>
<summary>✅ v1.8 / M008: Dashboard Intelligence (Phase 29) — SHIPPED 2026-05-20</summary>

- [x] Phase 29: dashboard-intelligence — Deviation view + chart clarity *(complete 2026-05-20)*
  - [x] 29-01: D-01 fix, deviation utilities, test scaffolds
  - [x] 29-02: getCategoryDeviations DAL + DeviationBadge
  - [x] 29-03: EntrateUsciteChart + BilancioBarsChart (MonthlyTrendChart deleted)
  - [x] 29-04: Wire deviation into category pages + sort toggle

</details>

## v1.9 Social Auth

- [ ] **Phase 30: oauth-config** — OAuth provider setup, env wiring, and registration guardrail removal
- [ ] **Phase 31: oauth-ui** — Social login/register buttons on auth pages
- [ ] **Phase 32: account-linking** — Link/unlink providers from settings

## Phase Details

### Phase 30: oauth-config
**Goal**: The app can authenticate users via Google and GitHub OAuth with correct env-driven provider activation and no registration guardrail
**Depends on**: Phase 29 (existing auth foundation)
**Requirements**: ENV-01, ENV-02, ENV-03, REG-01
**Success Criteria** (what must be TRUE):
  1. Adding GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET to env activates the Google provider in Better Auth with no code change
  2. Adding GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET to env activates the GitHub provider in Better Auth with no code change
  3. A user without a pre-approved email can complete OAuth registration without hitting an ALLOWED_EMAIL error
  4. The deploy runbook documents both OAuth env variable pairs and required callback URL format
**Plans**: TBD

### Phase 31: oauth-ui
**Goal**: Users can sign in or register with Google and GitHub directly from the login and register pages, with provider buttons hidden when credentials are absent
**Depends on**: Phase 30
**Requirements**: OAUTH-01, OAUTH-02, OAUTH-03, OAUTH-04, OAUTH-05
**Success Criteria** (what must be TRUE):
  1. Login page shows a "Continue with Google" button when GOOGLE_CLIENT_ID is set, and the button is absent when it is not
  2. Login page shows a "Continue with GitHub" button when GITHUB_CLIENT_ID is set, and the button is absent when it is not
  3. Clicking a provider button starts the OAuth flow and lands the user in the app on success
  4. A brand-new user who authenticates via Google or GitHub gets an account created automatically (first-time registration path)
  5. Register page mirrors the same provider buttons under the same env conditions
**Plans**: TBD
**UI hint**: yes

### Phase 32: account-linking
**Goal**: Users can view, link, and unlink social providers from the settings page without losing access to their account
**Depends on**: Phase 31
**Requirements**: LINK-01, LINK-02, LINK-03, LINK-04
**Success Criteria** (what must be TRUE):
  1. Settings page shows a "Connected accounts" section listing which providers are currently linked
  2. User can link Google to an existing email/password account via an OAuth flow initiated from settings
  3. User can link GitHub to an existing email/password account via an OAuth flow initiated from settings
  4. User can unlink a provider only when at least one other auth method (password or another provider) remains on the account
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1–23 | M001–M006 | 87/87 | Complete | 2026-05 |
| 24–28 | M007 | 20/20 | Complete | 2026-05-19 |
| 29 | v1.8/M008 | 4/4 | Complete | 2026-05-20 |
| 30 | v1.9 | 0/? | Not started | — |
| 31 | v1.9 | 0/? | Not started | — |
| 32 | v1.9 | 0/? | Not started | — |

**Total: 32 phases · 111 plans complete · 3 phases pending (v1.9)**
