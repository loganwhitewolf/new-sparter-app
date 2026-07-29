---
phase: 81
slug: inline-net-display-for-paired-transactions
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-29
---

# Phase 81 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| RSC transactions page → transaction-table.tsx (client) | pairedWithId/pairedNetAmount/pairedDescription/reimbursementId are already fetched server-side, userId-scoped by the unmodified transactionListSelect/DAL query — this phase reads no new field and adds no new server round-trip | Same-user-owned pairing metadata (no new field, no new fetch) |
| transaction-table.tsx → PairedReductionBadge Link href | pairedWithId is a same-user-owned transaction id, already resolved server-side by the pre-existing, unmodified pairedCounterpartIdExpr(); rendered into a same-origin internal route href via transactionDetailHref, never an external URL or raw HTML | Same-origin internal route id (no external URL, no raw HTML) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-81-01 | Information Disclosure | PairedReductionBadge anchor link | low | accept | pairedWithId is already resolved server-side by the pre-existing, unmodified pairedCounterpartIdExpr() (scoped by the transaction table's own userId ownership joins); the badge's Link target is a route (transactionDetailHref) the same user could already reach via the existing pair popover / ReimbursementRowIndicator — this phase adds a second navigation path to an already-reachable page, no new disclosure surface | closed — below high threshold (non-blocking) |
| T-81-02 | Tampering | client-side resolvePairRole (sign of transaction.amount) | low | accept | pairRole is a pure display classification with no write effect; worst case is a mislabeled badge/strikethrough on a single row — it can never mutate a total, an aggregate, or effectiveAmount() (D-N4 keeps every total untouched; the sign invariant it reads is enforced at write time by assertOutflowAnchorAmount/assertInflowRefundAmount) | closed — below high threshold (non-blocking) |
| T-81-03 | Repudiation | none — no new write path | n/a | accept | this phase has no server action, no mutation, and no new audit-relevant event; there is nothing to repudiate | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-81-01 | T-81-01 | Second navigation path to an already-reachable, userId-scoped internal route; no new disclosure surface | Andrea | 2026-07-29 |
| AR-81-02 | T-81-02 | Presentation-only pair-role classification; cannot mutate any total or aggregate (D-N4), sign invariant enforced at write time | Andrea | 2026-07-29 |
| AR-81-03 | T-81-03 | Display-only phase with no server action, mutation, or audit-relevant event | Andrea | 2026-07-29 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-29 | 3 | 3 | 0 | gsd-secure-phase (L1 short-circuit: threats_open=0, register authored at plan time, asvs_level=1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-29
