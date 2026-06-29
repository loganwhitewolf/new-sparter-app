# Quick Task 260629-m9i: Separa transazione in spesa dedicata (detach da expense aggregata) - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Task Boundary

Permettere di staccare una singola transazione da un'Expense aggregata (stesso `descriptionHash` bancario) e crearne una dedicata con titolo e categoria propri, senza modificare il CSV prima dell'import.

**Caso d'uso principale:** bonifici P2P verso la stessa persona (es. Andrea D'Este) dove la maggior parte sono quote ricorrenti (streaming) ma occasionalmente una riga è un rimborso quota pranzo/ristorante.

**Non in scope:** categorizzazione per-transazione su tutte le superfici; bulk detach; spostamento in spesa esistente (solo creazione nuova spesa dedicata).

</domain>

<decisions>
## Implementation Decisions

### Punto di ingresso UI
- Azione **solo dalla tabella transazioni** (menu ⋮ sulla riga).
- Label prodotto italiana: **"Separa in spesa dedicata"** (o equivalente chiaro).
- Non esporre nel dialog Dettagli spesa in questo quick (YAGNI).

### Flusso post-detach
- Dopo lo stacco, aprire **subito** il flusso di categorizzazione sulla nuova spesa (SubcategoryPicker / dialog categorizzazione esistente).
- La nuova spesa parte `status: '1'` finché l'utente non conferma la categoria; al salvataggio → `status: '3'` + history `source: manual`.

### Titolo nuova spesa
- Dialog con campo titolo **precompilato** da `transaction.customTitle` se presente, altrimenti `transaction.description` (troncato a 120 char come `expense.title`).
- Utente **può editare** prima di confermare; titolo non vuoto obbligatorio.

### Re-import e lock categoria manuale (stesso quick, task 2)
- **Includere** nel PLAN un secondo task: al re-import, **non sovrascrivere** `subCategoryId` di un'Expense già categorizzata manualmente.
- Regola: se l'Expense esistente ha `status = '3'` e l'ultima riga in `expense_classification_history` per quell'`expenseId` ha `source = 'manual'`, preservare `subCategoryId` e `status` esistenti anche se `categorizePipeline` restituisce un altro match.
- Le nuove transazioni con lo stesso `descriptionHash` si agganciano comunque all'Expense esistente; solo la categoria non viene ricalcolata.

### Comportamento tecnico detach (Claude's Discretion — non discusso)
- **Non duplicare** la transazione: spostare `transaction.expenseId` su nuova Expense.
- `descriptionHash` sintetico univoco per la nuova spesa, es. SHA-256 di `detached:{transactionId}` — non collide con hash bancari né con `(userId, descriptionHash)` di altre spese.
- Ricalcolare `totalAmount`, `transactionCount`, `firstTransactionAt`, `lastTransactionAt` su Expense sorgente e destinazione (riuso pattern `transaction-deletion.ts` / `applyExpenseReconciliation`).
- Se l'Expense sorgente resta senza transazioni: applicare la stessa politica già usata in delete/reconcile (preservare vuota o eliminare — allinearsi al comportamento esistente in `transaction-deletion.ts`, non inventarne uno nuovo).
- Al re-import: transazione già presente → dedup per `transactionHash`; transazioni staccate **non** si riattaccano al gruppo bancario originale.
- Auth: `verifySession` + scope `userId` su transazione e entrambe le expense (IDOR).

### Claude's Discretion
- Copy esatti UI, struttura file service/action, scelta tra dialog modale dedicato vs riuso componenti esistenti.
- Test: service detach + re-import preserve manual + action smoke.

</decisions>

<specifics>
## Specific Ideas

- Esempio utente: Expense "Andrea D'Este" → Streaming; una transazione quota pranzo → staccata → "Pranzo con amici" → Ristoranti.
- `customTitle` resta display-only e non influenza il raggruppamento import; il titolo della nuova Expense è indipendente.

</specifics>

<canonical_refs>
## Canonical References

- `CONTEXT.md` — principi categorizzazione per scopo, non per beneficiario; netting rimborsi per sottocategoria.
- `docs/init/BUSINESS_LOGIC_HANDOFF.md` — Expense = aggregazione per `descriptionHash`; Transaction N:1 Expense.
- `lib/services/import.ts` — upsert expense per `(userId, descriptionHash)`; linea che sovrascrive `subCategoryId` al re-import.
- `lib/services/transaction-deletion.ts` — riconciliazione totali expense dopo rimozione/spostamento transazioni.

</canonical_refs>
