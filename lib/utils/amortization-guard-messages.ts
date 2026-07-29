// Shared, client-safe (no 'server-only') Italian guard copy (Phase 77, UI-SPEC "Guard tooltip") —
// used by BOTH the server-side getAmortizationEligibility (lib/services/amortization-guards.ts)
// and the client-side row-action gate (components/transactions/transaction-table.tsx), so the two
// independent eligibility checks (D-04..D-07 + outflow-only) never drift on copy.
export type AmortizationIneligibilityReason =
  | 'reimbursement'
  | 'already-amortized'
  | 'expense-group'
  | 'not-outflow'
  | 'too-small'

export type AmortizationGuardFailure =
  | { reason: Exclude<AmortizationIneligibilityReason, 'too-small'> }
  | { reason: 'too-small'; requiredPerMonth: string }

export function amortizationGuardMessage(failure: AmortizationGuardFailure): string {
  switch (failure.reason) {
    case 'reimbursement':
      return 'Non puoi ammortizzare una transazione coinvolta in un rimborso. Scollega il rimborso prima.'
    case 'already-amortized':
      return 'Questa transazione ha già una pianificazione attiva. Rimuovila prima di crearne una nuova.'
    case 'expense-group':
      return 'Non puoi ammortizzare una transazione che fa parte di un gruppo di spese. Rimuovila dal gruppo prima.'
    case 'not-outflow':
      return 'Puoi ammortizzare solo transazioni in uscita.'
    case 'too-small':
      return `Importo troppo piccolo. Ammortizzare su 2 mesi richiederebbe rate di €${failure.requiredPerMonth}, impossibili.`
    default: {
      const exhaustive: never = failure
      return exhaustive
    }
  }
}
