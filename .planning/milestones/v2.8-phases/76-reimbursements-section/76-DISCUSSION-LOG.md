# Phase 76: reimbursements-section - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-27
**Phase:** 76-reimbursements-section
**Areas discussed:** List content & scope, Navigation / access, Per-reimbursement page layout, Status & badges

---

## List content & scope

| Option | Description | Selected |
|--------|-------------|----------|
| Tutti i rimborsi | Every reimbursement incl. migrated N=1 and settled; canonical full list, rely on filter/sort | ✓ |
| Solo con residuo aperto | Default only owed/surplus; settled behind a filter | |
| Tutti tranne N=1 banali | Exclude direct 1:1 pairs as noise | |

**User's choice:** Tutti i rimborsi
**Notes:** Canonical complete list; volume handled by sort + status filter (D-01).

| Option | Description | Selected |
|--------|-------------|----------|
| Residuo dovuto prima | Sort by status/residual, owed first | |
| Data àncora recente | Most recent anchor date first (like other tables) | ✓ |
| Ultima modifica | Most recently touched first | |

**User's choice:** Data àncora recente (D-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Fallback a descrizione àncora | Empty title → show anchor description | ✓ |
| Titolo esplicito richiesto | Always title; placeholder if empty | |
| Titolo + àncora sempre | Both, two-line dense row | |

**User's choice:** Fallback a descrizione àncora (D-03)

---

## Navigation / access

| Option | Description | Selected |
|--------|-------------|----------|
| Voce sidebar top-level | New "Rimborsi" first-class sidebar item | ✓ |
| Sotto Spese | Sub-section/tab under Spese | |
| Solo link contestuali | No sidebar, only contextual links | |

**User's choice:** Voce sidebar top-level (D-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Sì, collega tutto | Panel on tx + row indicator link to the page; page is canonical management | ✓ |
| Solo indicatore tabella | Only row indicator links; panel stays autonomous | |
| Nessun link, per ora | Page reachable only from the list | |

**User's choice:** Sì, collega tutto (D-06) — drove D-09 (panel on tx becomes summary + "Gestisci").

---

## Per-reimbursement page layout

| Option | Description | Selected |
|--------|-------------|----------|
| Report ricco + panel riusato | /tags/[id]-style header (title + KPI + anchor summary) + reused ReimbursementPanel | ✓ |
| Solo ReimbursementPanel | Panel mounted standalone + edit-title | |
| Report nuovo da zero | Fully new page, re-build actions | |

**User's choice:** Report ricco + panel riusato (D-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Inline nell'header | Clickable title → input (TransactionTitleEdit pattern) | ✓ |
| Dialog dedicato | EditTagDialog-style dialog | |
| Tu decidi | Planner's choice | |

**User's choice:** Inline nell'header (D-08)

| Option | Description | Selected |
|--------|-------------|----------|
| Riepilogo + 'Gestisci' | Tx panel becomes read-only summary + link to page | ✓ |
| Resta gestione piena | Panel keeps full add/remove/delete in parallel | |
| Tu decidi | Planner's choice | |

**User's choice:** Riepilogo + 'Gestisci' (D-09)

---

## Status & badges

| Option | Description | Selected |
|--------|-------------|----------|
| Badge colorati + residuo | Colored owed/settled/surplus badges + residual, list + header | ✓ |
| Solo testo residuo | No colored badge, text value only | |
| Tu decidi | Planner's choice | |

**User's choice:** Badge colorati + residuo (D-10)

| Option | Description | Selected |
|--------|-------------|----------|
| Sì, filtro per stato | Status filter (owed/settled/surplus) in the unified table | ✓ |
| Solo search, niente filtro | Text search only | |
| Tu decidi | Planner's choice | |

**User's choice:** Sì, filtro per stato (D-11)

---

## Claude's Discretion

- The new "list all reimbursements" DAL shape, joins, and index/perf strategy (IDOR-scoped).
- Sidebar icon + position; column formatting; empty-state and delete-confirm copy; Italian wording.
- Exact split of `ReimbursementPanel` into summary vs full-management variants and how the reused
  panel mounts on the page.

## Deferred Ideas

- Group-anchored reimbursements UI (trip/vacation) → future tag-anchor primitive.
- RMB-F1 subscription temporal amortization → later milestone (ADR 0018 §6).
- RMB-F2 refund CSV export from a reimbursement page.
- Bulk actions on the list (multi-delete, mark-settled) → own phase if ever wanted.
