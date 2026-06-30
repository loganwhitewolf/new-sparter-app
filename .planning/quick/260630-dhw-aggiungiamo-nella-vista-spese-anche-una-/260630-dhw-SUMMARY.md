---
status: complete
quick_id: 260630-dhw
---

# Quick Task 260630-dhw — Summary

**CTA "Da categorizzare" nella vista Spese**

## Fatto

- Pill amber `Da categorizzare (N)` nella header row, accanto a "Nuova spesa" (decisione UI sessione)
- Toggle: clic applica/rimuove `?status=uncategorized`
- `getUncategorizedExpenseCount()` in DAL (bucket status `['1','4']`, all-time)
- Rimosso filtro "Categorizzazione" da `expenses.table.ts`

## File

- `components/expenses/expense-uncategorized-cta.tsx` (nuovo)
- `lib/dal/expenses.ts`
- `app/(app)/expenses/page.tsx`
- `app/(app)/expenses/expenses.table.ts`
- `tests/expense-uncategorized-cta.test.tsx` (nuovo)
- `tests/expenses-dal.test.ts`

## Verifica

- `yarn vitest run tests/expense-uncategorized-cta.test.tsx tests/expenses-dal.test.ts` — 21 passed

## Decisioni UI (CONTEXT)

- Posizione: pill header (come OverviewNudge)
- Count visibile nel testo
- Toggle off quando filtro attivo
