---
status: partial
phase: 32-account-linking
source: [32-VERIFICATION.md]
started: 2026-05-22T00:00:00Z
updated: 2026-05-22T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. LINK-01: Google OAuth link round-trip
expected: Cliccare Collega sulla riga Google avvia il redirect OAuth. Al ritorno su /settings/profile?linked=google il Badge mostra "Collegato" e appare il toast con il nome del provider.
result: [pending]

### 2. LINK-02: GitHub OAuth link round-trip
expected: Stesso flusso per GitHub. Al ritorno su /settings/profile?linked=github il Badge mostra "Collegato" e appare il toast.
result: [pending]

### 3. LINK-03: Unlink di un provider collegato
expected: Dopo aver collegato un provider, cliccare Scollega apre il Dialog di conferma. Confermando, appare il toast "Provider scollegato." e il Badge torna a "Non collegato".
result: [pending]

### 4. LINK-03: Guard canUnlink — ultimo metodo di accesso
expected: Quando rimane un solo metodo di accesso (solo social, nessuna credenziale email/password), il pulsante Scollega è disabilitato con tooltip "Non puoi scollegare l'unico metodo di accesso."
result: [pending]

### 5. LINK-01/02: Email mismatch error
expected: Completare il flow OAuth con un account provider la cui email differisce dall'email Sparter. Il callback redirige a /settings/profile?error=email_doesn%27t_match. La Card mostra l'Alert italiano "L'email del provider non corrisponde all'email del tuo account Sparter."
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
