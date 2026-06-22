---
status: diagnosed
phase: 53-retroactive-application
source: [53-VERIFICATION.md]
started: 2026-06-16T15:50:36Z
updated: 2026-06-17T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Browser apply feedback
expected: Dopo la promozione, la SuggestionCard mostra inline il risultato apply (es. "3 categorizzate · 1 ancora senza match") senza che la card venga rimossa dalla lista
result: issue
reported: "Aperta pagina suggerimenti per file Crypto.com con 8 transazioni 'EUR deposit' tutte identiche. Il sistema suggerisce di creare un pattern regex per descrizioni completamente identiche, ma se sono tutte uguali non è un pattern — è una stringa fissa. Non dovrebbero essere suggerite come cluster regex."
severity: major

### 2. Cross-platform DB isolation
expected: Promuovere un suggerimento Fineco non categorizza transazioni Revolut. Solo le spese uncategorized della stessa piattaforma vengono aggiornate.
result: blocked
blocked_by: prior-phase
reason: "Dopo aver eliminato un suggerimento (EUR deposit Crypto.com) e rilanciato la discovery dalla lista dei file, la pagina suggerimenti non mostra più nessun suggerimento. Impossibile testare l'isolamento cross-platform senza un suggerimento promuovibile."

### 3. notFound HTTP response quando platform chain è mancante
expected: Se il fileId non ha una piattaforma risolvibile, la pagina /import/[fileId]/suggestions risponde 404 nel browser (non crash 500)
result: skipped
reason: "Non è stato possibile costruire il caso di test (nessun file senza piattaforma disponibile)"

## Summary

total: 3
passed: 0
issues: 1
pending: 0
skipped: 1
blocked: 1

## Gaps

- truth: "Il sistema non suggerisce pattern regex per cluster di transazioni con descrizione identica (stessa stringa esatta) — queste non sono 'pattern' ma stringhe fisse; la discovery dovrebbe sopprimere o escludere cluster dove tutte le occorrenze hanno title identico"
  status: failed
  reason: "User reported: 8 transazioni Crypto.com tutte con 'EUR deposit' identico vengono mostrate come suggerimento regex, ma descrizioni identiche non sono un pattern sintattico"
  severity: major
  test: 1
  artifacts: []
  missing: []
