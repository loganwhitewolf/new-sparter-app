---
phase: 77-amortization-schema-and-activation
plan: 03
subsystem: transactions
tags: [drizzle, postgres, decimal.js, server-actions, react, zod]

# Dependency graph
requires:
  - phase: 77-01
    provides: activatePlanTx (D-03/AMORT-02 atomic detach+plan+instalment write), materializeInstalments/validateMonthsForAmount/maxMonthsForAmount (AMORT-03), getAmortizationEligibility (D-04..D-07 + outflow-only), ActivateAmortizationDialog preview-table pattern
  - phase: 77-02
    provides: amortizationPlanId threaded through lib/dal/transactions.ts (read for correctness, not modified by this plan)
provides:
  - insertManualTransactionTx (tx-composable core of manual transaction creation, lib/dal/transactions.ts)
  - createTransaction extended with the atomic create+amortize combined path (D-10, third AMORT-01 entry point)
  - CreateTransactionSchema amortizationEnabled/amortizationMonths fields with superRefine (T-77-09)
  - components/ui/checkbox.tsx (shadcn Checkbox primitive, first use in this repo)
  - Inline "Ammortizza questa transazione" checkbox + compact preview on the manual-entry form
affects: [78-plan-lifecycle-and-reconciliation, 79-amortizations-registry]

# Tech tracking
tech-stack:
  added: [components/ui/checkbox.tsx (radix-ui Checkbox, dependency already present)]
  patterns:
    - "Tx-core-plus-thin-wrapper split for manual transaction creation (insertManualTransactionTx / insertManualTransaction), mirroring applyDetachCleanupTx — the tx-accepting core has no internal db.transaction, so a caller can compose it with activatePlanTx inside ONE db.transaction"
    - "Client-side preview math reuses the exact server-side normalization (amount.replace(',', '.')) before calling the shared pure functions (maxMonthsForAmount/validateMonthsForAmount/materializeInstalments) — zero drift between the manual-entry compact preview and the row/detail dialog's preview"

key-files:
  created:
    - components/ui/checkbox.tsx
    - tests/amortization-manual-entry.test.ts
  modified:
    - lib/dal/transactions.ts
    - lib/actions/transactions.ts
    - lib/validations/transactions.ts
    - components/transactions/transaction-form-dialog.tsx

key-decisions:
  - "createTransaction's CreateTransactionResult extends ActionState with optional amortized/months fields rather than a separate action — useActionState's initial state ({ error: null }) already satisfies the wider type since both new fields are optional, so no call-site outside this dialog needs updating."
  - "The default (non-amortized) submit button label changed from 'Salva transazione' to 'Crea transazione' to match the UI-SPEC's D-10 copywriting contract exactly ('Crea transazione' / 'Crea e ammortizza' pair) — the plan's own <action> text specifies this exact pair, not a preservation of the old label."
  - "The manual-entry preview reuses the same bounded-height + IntersectionObserver incremental-render technique as ActivateAmortizationDialog (not a simpler unbounded render) — the UI-SPEC's E1/E4 'overflow (long plan)' resolution explicitly names E4 alongside E1, so the safeguard applies here too even though manual-entry N is expected to stay small."

patterns-established:
  - "Amount/date fields on a manual-entry form move from uncontrolled (defaultValue) to controlled (value+onChange) the moment a sibling preview needs to read them live — FormData submission is unaffected since controlled inputs still carry a `name` attribute."

requirements-completed: [AMORT-01]

coverage:
  - id: D1
    description: "createTransaction composes insertManualTransactionTx + activatePlanTx inside ONE db.transaction: a valid amortizationEnabled+amortizationMonths submission creates the transaction, detaches it into a new Standalone Expense, creates the amortization_plan, and materialises N instalments summing to the entered amount"
    requirement: "AMORT-01"
    verification:
      - kind: integration
        ref: "tests/amortization-manual-entry.test.ts#creates transaction + plan + instalments in one atomic write when amortizationEnabled is on"
        status: pass
    human_judgment: false
  - id: D2
    description: "A not-outflow (positive amount) or too-small (N=1) submission with amortizationEnabled returns the same Italian guard message the row/detail dialogs use, and creates ZERO rows (not even the transaction) — proving the combined write is one atomic unit, never create-then-fail-to-amortize"
    requirement: "AMORT-01"
    verification:
      - kind: integration
        ref: "tests/amortization-manual-entry.test.ts#returns the outflow-only error and creates nothing for a positive amount"
        status: pass
      - kind: integration
        ref: "tests/amortization-manual-entry.test.ts#returns the minimum-months error and creates nothing when amortizationMonths is 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "createTransaction with amortizationEnabled unset/off behaves exactly as before this plan — plain transaction, no plan, no instalments (regression safety for the pre-existing manual-entry path)"
    verification:
      - kind: integration
        ref: "tests/amortization-manual-entry.test.ts#behaves exactly as before this plan when amortizationEnabled is unset (regression safety)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The manual create-transaction form offers the 'Ammortizza questa transazione' checkbox, Mesi input, and compact inline preview inheriting the row/detail dialog's exact validation and preview math; the checkbox stays inert (no months input) while the amount is not negative; the submit button and success toast branch on amortization state"
    requirement: "AMORT-01"
    verification:
      - kind: unit
        ref: "node_modules/.bin/tsc --noEmit (clean — Checkbox/preview/toast branching wired against the extended CreateTransactionResult type)"
        status: pass
    human_judgment: true
    rationale: "Visual verification of the checkbox reveal, compact preview table styling (smaller font/tighter spacing vs. the row dialog), and the submit-button/toast copy branching requires a human to click through the real dialog in a browser — no automated visual assertion exists for this phase."

# Metrics
duration: ~10min
completed: 2026-07-28
status: complete
---

# Phase 77 Plan 03: Manual-Entry Create+Amortize Summary

**Third AMORT-01 entry point: an inline "Ammortizza questa transazione" checkbox on the manual create-transaction form that atomically creates, detaches, plans, and materialises instalments in one db.transaction, reusing activatePlanTx unmodified**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-28
- **Tasks:** 2
- **Files modified:** 6 (4 modified, 2 created)

## Accomplishments
- Split `insertManualTransaction` into a tx-composable `insertManualTransactionTx` core (mirroring `applyDetachCleanupTx`'s established pattern) so it can run inside the same `db.transaction` as `activatePlanTx`.
- Extended `CreateTransactionSchema` with `amortizationEnabled`/`amortizationMonths` (superRefine enforces "Minimo 2 mesi." when the checkbox is on but months is missing/invalid) and wired `createTransaction` to run both writes atomically — a guard failure or write error rolls back the transaction insert too.
- Added the shadcn `Checkbox` primitive (first use in this repo; `radix-ui` was already a project dependency) and wired an inline "Ammortizza questa transazione" checkbox + Mesi input + compact preview table into `TransactionFormDialog`, reusing the exact same pure math (`maxMonthsForAmount`/`validateMonthsForAmount`/`materializeInstalments`) as the row/detail activation dialog.
- Proved the combined atomic path against a real Postgres harness: happy path, not-outflow rejection, too-small (N=1) rejection (both leaving zero rows), and the unchanged non-amortized regression path.

## Task Commits

Each task was committed atomically:

1. **Task 1: Atomic combined create+amortize action (D-10)** - `071f4e9` (feat, tdd)
2. **Task 2: Manual-entry form checkbox, months input, compact inline preview (D-10)** - `35a5556` (feat)

_Note: Task 1 is TDD-flavored (real-Postgres integration tests written and run against the actual implementation in the same commit — the plan's `<behavior>` block enumerates the 4 cases the test file covers)._

## Files Created/Modified
- `lib/dal/transactions.ts` - `insertManualTransactionTx` (tx-composable core) + `insertManualTransaction` (thin `db.transaction` wrapper, signature-preserving)
- `lib/validations/transactions.ts` - `CreateTransactionSchema` extended with `amortizationEnabled`/`amortizationMonths` + `superRefine`
- `lib/actions/transactions.ts` - `createTransaction` extended with the atomic combined path; `CreateTransactionResult` type (`ActionState & { amortized?; months? }`)
- `components/transactions/transaction-form-dialog.tsx` - inline checkbox, Mesi input, compact preview, submit-label/toast branching
- `components/ui/checkbox.tsx` - shadcn Checkbox primitive (new)
- `tests/amortization-manual-entry.test.ts` - real-Postgres regression proof (new)

## Decisions Made
- `CreateTransactionResult` extends `ActionState` with optional fields rather than introducing a separate return type/action — keeps `useActionState`'s initial state (`{ error: null }`) valid with zero call-site changes elsewhere.
- Changed the default (non-amortized) submit button label from "Salva transazione" to "Crea transazione" per the UI-SPEC's exact D-10 copywriting pair ("Crea transazione" / "Crea e ammortizza") — an intentional label change specified by the plan's own `<action>` text, not a side effect.
- Kept the bounded-height + `IntersectionObserver` incremental-render preview technique for the compact variant (not a simplified unbounded render), since the UI-SPEC's "overflow (long plan)" resolution names E4 (manual-entry) alongside E1 (dialog) explicitly.

## Deviations from Plan

None - plan executed exactly as written. The `components/ui/checkbox.tsx` addition was anticipated by the plan's own `<action>` text ("add a Checkbox (shadcn)") and installed via the shadcn CLI against the project's existing `components.json`/`radix-ui` dependency — not an unplanned package install.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
All three AMORT-01 entry points (row action, detail page, manual entry) now share the identical guard/eligibility logic, preview math, and atomic write path (`activatePlanTx`). `tsc --noEmit` is clean, the full suite (153 files / 1865 tests) is green, and `yarn check:language` passes. Ready for Phase 78 (plan lifecycle and reconciliation) and Phase 79 (amortizations registry) to build on `activatePlanTx`/`amortization-math.ts` without further changes to the activation surface.

---
*Phase: 77-amortization-schema-and-activation*
*Completed: 2026-07-28*

## Self-Check: PASSED

All created/modified files present on disk; both task commits (`071f4e9`, `35a5556`) found in git history.
