---
phase: 81-inline-net-display-for-paired-transactions
verified: 2026-07-29T14:32:47Z
status: passed
score: 3/3 truths verified
behavior_unverified: 0
overrides_applied: 0
human_verification:

  - test: "On staging/local, open the transactions table with a real closed-for-sale amortization plan (D-N2) and a real v2.8 reimbursement pairing (D-N3): confirm the anchor row shows the net figure prominently with the gross amount struck-through/opaque beneath it, and the counterpart row shows the 'riduzione di …' badge with an attenuated amount and correct link target."
    expected: "Anchor row reads net-primary + struck-through gross; counterpart row reads attenuated + badge linking to the anchor's own detail page; unpaired rows look identical to before the phase."
    why_human: "Held out by the phase itself (SUMMARY 'Notes / held-out'): renderToStaticMarkup assertions prove the markup/href are correct, but the live-browser visual treatment (typography scale, opacity, truncation on real merchant labels) on real production-shaped data was explicitly deferred to a human eyeball pass before shipping v2.9."
---

# Phase 81: Inline net display for paired transactions Verification Report

**Phase Goal:** In the transactions table, a paired anchor (amortization-sale or v2.8
reimbursement) shows its net amount prominently with the gross initial amount
struck-through/dimmed beneath it, and the paired counterpart row carries a "riduzione di …" badge
linking to its anchor with an attenuated amount — so a user reading the table alone understands
the real net without opening the detail page. Purely presentational: `effectiveAmount()`, netting,
and all totals stay unchanged.

**Verified:** 2026-07-29T14:32:47Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A paired outflow anchor renders `pairedNetAmount` as the primary amount-cell figure with the gross `amount` struck-through/opaque beneath it, for all pairing types (amortization-sale AND v2.8 reimbursement) via one code path | ✓ VERIFIED | `resolvePairRole` (transaction-table.tsx:168-173) reads only `pairedWithId` + sign of `amount`; both `lib/actions/transaction-pairs.ts:258` (v2.8 reimbursement) and `lib/services/amortization-lifecycle.ts:273` (amortization-sale realization) call the single `createPairTx` (transaction-pairs.ts:84), which internally invokes `assertOutflowAnchorAmount`/`assertInflowRefundAmount` (lines 161-162, 262-263) — proving one write path, hence one read-side discriminator is correct for both. Amount cell split (lines 631-639) renders both figures with `line-through` on the gross span only. Render test `TransactionTable — anchor row net-primary amount display (D-N2)` passes (asserts both figures + `line-through` present; unpaired row has none). |
| 2 | The counterpart row shows a "riduzione di …" badge linking to its anchor transaction, amount attenuated, replacing the reimbursement-management badge on that row only | ✓ VERIFIED | `paired-reduction-badge.tsx` exports `PairedReductionBadge`, links via `transactionDetailHref(anchorTransactionId)` (not `/reimbursements/[id]`), renders `riduzione di {label}`. transaction-table.tsx:617-626 swaps it in exclusively for `pairRole === 'counterpart'`, else keeps `ReimbursementRowIndicator` unchanged. Amount cell (lines 640-650) applies `text-muted-foreground opacity-60` only for counterpart role. Render test confirms badge text + correct `href`, and asserts `Rimborso collegato` (ReimbursementRowIndicator's aria-label) is ABSENT on that same row (exclusive swap, not additive); a second test confirms the anchor-role row still shows `Rimborso collegato` unchanged. |
| 3 | No change to any total, `effectiveAmount()`, netting math, or dashboard/lens figure; full suite incl. LENS-03 byte-identical assertions stays green; `lib/dal/transactions.ts` unmodified | ✓ VERIFIED | `git diff` on both phase commits (75026784, 695f9e5c) touches only `components/transactions/transaction-table.tsx`, `components/transactions/paired-reduction-badge.tsx` (new), and `tests/transaction-table-paired-net-display.test.tsx` — confirmed via `git show --stat` on each commit individually. `git diff 18a40fb1..695f9e5c -- lib/dal/transactions.ts lib/dal/transaction-pairs-sql.ts` is empty (zero DAL/effectiveAmount change). Full suite run fresh by this verifier: 161 files, 1957 passed, 1 todo — matches SUMMARY's claim exactly. `tests/reimbursement-regression.test.ts` (LENS-03 byte-identical block, ~line 1216/1494) passes as part of that run. |

**Score:** 3/3 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `components/transactions/transaction-table.tsx` | `resolvePairRole` + split amount cell + badge swap | ✓ VERIFIED | Substantive, wired: `resolvePairRole` defined and consumed at line 574; amount cell and title-row badge both consult the same `pairRole` value. |
| `components/transactions/paired-reduction-badge.tsx` | New component, exports `PairedReductionBadge` | ✓ VERIFIED | Exists, substantive (44 lines, real Link+Badge markup, no stub patterns), imported and used in transaction-table.tsx:19,618. |
| `tests/transaction-table-paired-net-display.test.tsx` | Render tests for anchor/counterpart/unpaired | ✓ VERIFIED | 4 test cases covering all three behaviors from <behavior> blocks in both tasks; all pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `transaction-table.tsx` amount cell | `resolvePairRole(transaction)` | single per-row computation consumed by both amount-cell and title-badge branches | ✓ WIRED | Same `pairRole` const (line 574) read at line 617 (badge) and line 631/643 (amount cell) — single source of truth, cannot disagree. |
| `PairedReductionBadge` | `transactionDetailHref(pairedWithId)` | Link href | ✓ WIRED | `lib/routes.ts`'s `transactionDetailHref` imported and used; test asserts `href="/transactions/{ANCHOR_ID}"`. |
| `createPairTx` (both call sites) | `assertOutflowAnchorAmount`/`assertInflowRefundAmount` | sign invariant enforced at write time | ✓ WIRED | Both `lib/actions/transaction-pairs.ts:258` and `lib/services/amortization-lifecycle.ts:273` call the single `createPairTx`, which calls the asserts at lines 161-162/262-263 of `transaction-pairs.ts` — the invariant this phase's client-side discriminator depends on for zero-DAL-change safety. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|-------------|--------|----------|
| AMORT-05 | 81-01-PLAN.md | Realization readability (closure of Phase 78 UAT gap) — already marked Complete in REQUIREMENTS.md against Phase 78; this phase references it, adds no new REQ-ID | ✓ SATISFIED | Confirmed no new REQ-ID row expected; plan/roadmap both state this explicitly. Truths 1-2 above satisfy the readability gap. |

### Anti-Patterns Found

None. Scanned `transaction-table.tsx`, `paired-reduction-badge.tsx`, and the test file for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon` — zero matches in the phase-modified files.

### Behavioral Spot-Checks / Test Execution

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Type check | `node_modules/.bin/tsc --noEmit` | clean, no output | ✓ PASS |
| Language check | `yarn check:language` | "English code convention check passed." | ✓ PASS |
| Targeted tests | `yarn vitest run tests/reimbursement-regression.test.ts tests/transaction-table-paired-net-display.test.tsx` | 2 files, 30 tests passed | ✓ PASS |
| Full suite (run once, per D-N4 gate) | `yarn vitest run` | 161 files, 1957 passed, 1 todo (1958) | ✓ PASS |

### Human Verification Required

1. **Live-browser visual check on real data (held-out item)**
   - **Test:** Open the transactions table for a real user with a closed-for-sale amortization plan and a real v2.8 reimbursement pairing.
   - **Expected:** Anchor row shows the net amount prominently with the gross struck-through/opaque beneath; counterpart row shows the "riduzione di …" badge with attenuated amount and correct anchor link; unpaired rows look unchanged.
   - **Why human:** The phase's own SUMMARY documents this as an explicit held-out item — `renderToStaticMarkup` proves markup/href correctness, not the actual visual read on production-shaped labels/truncation. This is a pre-existing, phase-declared non-blocking gap, not a new finding from this verification pass.

### Gaps Summary

No gaps found. All three roadmap success criteria are verified against the actual committed code (not just SUMMARY narrative): the split amount-cell render, the exclusive badge swap, and the zero-DAL-change/full-suite-green invariant are all directly confirmed via `git show`/`git diff` on the phase commits and fresh test runs by this verifier. Status is `human_needed` solely because of the phase's own declared held-out live-browser UAT item — not because of any failed or missing artifact.

---

_Verified: 2026-07-29T14:32:47Z_
_Verifier: Claude (gsd-verifier)_
