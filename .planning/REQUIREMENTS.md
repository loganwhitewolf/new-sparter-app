# Requirements: Sparter v1.9

**Defined:** 2026-05-20
**Core Value:** The user can safely import real bank transactions, see where their money goes categorized by month, and instantly spot deviations from their baseline spending — all running on a zero-cost personal deploy.

## v1 Requirements

### OAuth Login / Register

- [x] **OAUTH-01**: User can sign in with an existing Google account
- [x] **OAUTH-02**: User can create a new account using Google OAuth
- [x] **OAUTH-03**: User can sign in with an existing GitHub account
- [x] **OAUTH-04**: User can create a new account using GitHub OAuth
- [x] **OAUTH-05**: Social provider buttons are hidden when provider credentials are not configured in env

### Account Linking

- [ ] **LINK-01**: User can link a Google account to their existing account from settings
- [ ] **LINK-02**: User can link a GitHub account to their existing account from settings
- [ ] **LINK-03**: User can unlink a linked provider (only when at least one other auth method remains)
- [ ] **LINK-04**: Settings page shows which providers are currently linked to the account

### Registration

- [x] **REG-01**: Registration guardrail (ALLOWED_EMAIL check) is removed — any user can register via social or email/password

### Environment / Config

- [x] **ENV-01
**: App reads GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google provider
- [x] **ENV-02
**: App reads GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to enable GitHub provider
- [x] **ENV-03
**: Deploy runbook documents required OAuth env variables and callback URL configuration

## v2 Requirements

### Additional Providers

- **PROV-01**: User can sign in / register with Apple
- **PROV-02**: User can sign in / register via magic link (passwordless email)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Apple OAuth | Requires Apple Developer account and certificate; defer to v2 |
| Magic link / passwordless | Out of scope for this milestone |
| SSO / SAML | Single-user personal finance app, not enterprise |
| Multi-user team accounts | Out of scope for v1.x (single-user) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| OAUTH-01 | Phase 31 | Complete 2026-05-21 |
| OAUTH-02 | Phase 31 | Complete 2026-05-21 |
| OAUTH-03 | Phase 31 | Complete 2026-05-21 |
| OAUTH-04 | Phase 31 | Complete 2026-05-21 |
| OAUTH-05 | Phase 31 | Complete 2026-05-21 |
| LINK-01 | Phase 32 | Pending |
| LINK-02 | Phase 32 | Pending |
| LINK-03 | Phase 32 | Pending |
| LINK-04 | Phase 32 | Pending |
| REG-01 | Phase 30 | Complete 2026-05-21 |
| ENV-01 | Phase 30 | Complete 2026-05-21 |
| ENV-02 | Phase 30 | Complete 2026-05-21 |
| ENV-03 | Phase 30 | Complete 2026-05-21 |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-20*
*Last updated: 2026-05-21 — OAUTH-01..05, REG-01, ENV-01..03 complete after Phase 30+31 execution*
