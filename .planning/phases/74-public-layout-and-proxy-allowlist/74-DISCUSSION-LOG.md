# Phase 74: public-layout-and-proxy-allowlist - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 74-public-layout-and-proxy-allowlist
**Milestone:** v2.9 Public Branding Site (branch `feat/v29-public-branding`)
**Areas discussed:** Smart root ownership, Allowlist SoT shape, Auth su deep link marketing, Stub pages vs link-slot

---

## Smart root ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Solo `proxy.ts` | Auth `/` → dashboard in proxy; anon hits `(public)` page | ✓ |
| Solo RSC page | Session branch in page; proxy only allowlists | |
| Ibrido | Proxy + page both check session | |

**User's choice:** Solo `proxy.ts`, with nuance that marketing deep links stay open when logged in.
**Notes:** User: “una volta loggato dobbiamo avere la possibilità di far aprire… how it works” — marketing paths must not join `AUTH_ROUTES`.

| Option | Description | Selected |
|--------|-------------|----------|
| Sempre `/` → dashboard se loggato | BRAND-05 stretto | ✓ |
| Query escape / `/home` | Logged-in can still see marketing home | |
| You decide | | |

**User's choice:** Always `/` → `/dashboard` when authenticated.

| Option | Description | Selected |
|--------|-------------|----------|
| Exact match only | Closed allowlist path list | ✓ |
| Exact + prefixes | Nested public routes | |
| You decide | | |

**User's choice:** Exact match; `/proto` keeps `startsWith`.

| Option | Description | Selected |
|--------|-------------|----------|
| Niente fino a Phase 77 | UI-SPEC as written | |
| Link Dashboard sempre visibile | Footer/header in Phase 74 | ✓ |
| You decide | | |

**User's choice:** Always-visible Dashboard link (extends UI-SPEC).

---

## Allowlist SoT shape

| Option | Description | Selected |
|--------|-------------|----------|
| `PUBLIC_MARKETING_ROUTES` + `PUBLIC_ROUTES` | Research ARCHITECTURE pattern | ✓ |
| Solo object stile `APP_ROUTES` | Named keys + Object.values | |
| Object + array esplicito | Both | |

**User's choice:** Research arrays pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| `AUTH_ROUTES` in `lib/routes.ts` | Shared with PUBLIC_ROUTES | ✓ |
| Solo locale in `proxy.ts` | | |
| You decide | | |

**User's choice:** `AUTH_ROUTES` in `lib/routes.ts`.

| Option | Description | Selected |
|--------|-------------|----------|
| Costanti nominate | Chrome imports named paths | ✓ |
| Solo array / literal | | |
| You decide | | |

**User's choice:** Named constants; Dashboard via `APP_ROUTES.dashboard`.

| Option | Description | Selected |
|--------|-------------|----------|
| Test mirati | Anon `/`, auth `/`, auth how-it-works, gated denial | ✓ |
| Smoke manuale solo | | |
| You decide | | |

**User's choice:** Targeted automated tests in Phase 74.

---

## Auth su deep link marketing

| Option | Description | Selected |
|--------|-------------|----------|
| Solo footer | Dashboard link | ✓ |
| Solo header | | |
| Header + footer | | |

**User's choice:** Footer only (desktop).

| Option | Description | Selected |
|--------|-------------|----------|
| “Dashboard” | English label | ✓ |
| “Vai all’app” | Italian | |
| “Area riservata” | | |

**User's choice:** Label “Dashboard”.

| Option | Description | Selected |
|--------|-------------|----------|
| Sì in Sheet mobile | | ✓ |
| No (solo footer) | | |
| You decide | | |

**User's choice:** Include Dashboard in mobile Sheet.

| Option | Description | Selected |
|--------|-------------|----------|
| Lascia Entra/Registrati visibili | AUTH_ROUTES → dashboard | ✓ |
| Nascondi già in 74 | Anticipate BRAND-12 | |
| You decide | | |

**User's choice:** Leave visible; session-aware in Phase 77.

---

## Stub pages vs link-slot

| Option | Description | Selected |
|--------|-------------|----------|
| Stub minimi in Phase 74 | UI-SPEC | ✓ |
| Solo homepage + allowlist | Stubs later (nav 404) | |
| Redirect temporanei a `/` | | |

**User's choice:** Minimal stubs in Phase 74.

| Option | Description | Selected |
|--------|-------------|----------|
| Homepage shell UI-SPEC | Minimal type-led placeholder | ✓ |
| Un filo più ricco | | |
| Pezzi Variant C già ora | Scope creep Phase 75 | |

**User's choice:** UI-SPEC minimal shell.

| Option | Description | Selected |
|--------|-------------|----------|
| “Contenuto in arrivo.” | UI-SPEC copy | ✓ |
| “Pagina in preparazione.” | | |
| Niente body | | |

**User's choice:** “Contenuto in arrivo.”

| Option | Description | Selected |
|--------|-------------|----------|
| Sì “Torna alla home” | | ✓ |
| No | | |
| You decide | | |

**User's choice:** Include “Torna alla home”.

---

## Claude's Discretion

- Colocation details under `app/(public)/_components/` vs inline layout
- Sheet ordering for Dashboard among links
- Exact test harness for D-07 allowlist/smart-root cases

## Deferred Ideas

- Session-aware header / SEO / sign-out → `/` — Phase 77
- Full Variant C + marketing components — Phase 75
- Legal MDX — Phase 76
- Phase ID renumber when v2.8 Reimbursements allocates roadmap phases (user acknowledged 2026-07-23)
