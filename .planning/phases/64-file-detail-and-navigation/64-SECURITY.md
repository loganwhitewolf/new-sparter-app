---
phase: 64
slug: file-detail-and-navigation
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-06
---

# Phase 64 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client→DAL (via RSC page) | `fileId` param arrives from the URL segment; must be scoped to the authenticated user before any row is returned | file/transaction rows |
| table row → detail page navigation | Client-side `Link` href built from the row's own `id` field, already scoped server-side by the table's data-fetch query | route path only |
| client→RSC route param | `fileId` arrives from the URL path segment, unauthenticated until `verifySession()` + `getFileDetailForUser()` run | file row |
| client→server action | delete/recheck/rename actions re-verify session + ownership server-side, never trusting `fileId` alone | mutation intent |
| client-side navigation only | Smart-back / Client-Cache-busting / `.group` CSS changes affect only client-side UX; no data access, no server round-trip beyond the RSC re-fetch Next.js already performs | none |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-64-01 | Information Disclosure | `getTransactionsByFileId` | high | mitigate | `WHERE eq(transaction.fileId, :fileId) AND eq(transaction.userId, :userId)` (`lib/dal/transactions.ts`) — verified in code | closed |
| T-64-02 | Tampering | `importFileDetailHref` | low | accept | Pure string builder, `encodeURIComponent` guards path injection | closed |
| T-64-03 | Tampering | `TransactionTitleEdit`/`ExpenseTitleEdit` Link href | low | accept | href built from an already ownership-scoped id; detail page re-verifies ownership regardless | closed |
| T-64-04 | Tampering | `FileDetailPage` status redirect | medium | mitigate | Server-side `redirect()`/`notFound()` in the RSC (`app/(app)/import/[fileId]/page.tsx:19,25,31,36`) — verified in code | closed |
| T-64-05 | Information Disclosure | `FileDetailPage` ownership check | high | mitigate | `getFileDetailForUser` scopes by `eq(file.userId, userId)`; non-owned/non-existent both resolve to `notFound()` — verified in code (`lib/dal/files.ts:146`) | closed |
| T-64-06 | Elevation of Privilege | `ImportDeleteDialog` reused with constructed row object | medium | mitigate | Delete goes through `deleteImportAction`, which re-verifies ownership server-side via `verifySession()` (`lib/actions/import.ts`) — verified in code | closed |
| T-64-07 | Information Disclosure | `getFileDetailForUser` | high | mitigate | `WHERE eq(file.id, :fileId) AND eq(file.userId, :userId)` — verified in code | closed |
| T-64-08 | Tampering | `ImportRowActions` Dettagli link | low | accept | href built from an already ownership-scoped `getImportRows` row | closed |
| T-64-09 | Information Disclosure | Import table title link (imported-only) | low | accept | Non-imported rows render `linkHref={undefined}` — defense in depth alongside RSC-level redirect | closed |
| T-64-10 | Denial of Service (UX) | `DetailPageShell` smart-back | low | mitigate | Underlying element stays `<a href={backHref}>` — verified in code (`components/detail-pages/detail-page-shell.tsx:108`) | closed |
| T-64-11 | Denial of Service (UX) | `DetailPageShell attachPopstateRefresh` | low | mitigate | `{ once: true }` bounds listener to one invocation, no resource accumulation | closed |
| T-64-12 | Information Disclosure | `.group` class additions (Plan 64-07 Task 1) | low | accept | Purely visual Tailwind utility, CSS cascade only — no data flow, no new input | closed |
| T-64-13 | Tampering | `handleBackClick` branch condition (Plan 64-07 Task 2) | low | accept | `window.history.length` is a browser-computed integer, no attacker-controlled semantics; removes a heuristic that was never a security control | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-64-01 | T-64-02, T-64-03, T-64-08, T-64-09, T-64-12, T-64-13 | Low-severity, no new data flow / no new untrusted input / no auth-authz surface — all confirmed at plan time and re-confirmed at audit time (T-64-12/13 introduced by Plan 64-07's CSS-only and history-length-only changes) | Claude (gsd-secure-phase, plan-time dispositions honored) | 2026-07-06 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-06 | 13 | 13 | 0 | Claude (gsd-secure-phase, L1 grep-depth verification against plan-authored STRIDE register) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-06
