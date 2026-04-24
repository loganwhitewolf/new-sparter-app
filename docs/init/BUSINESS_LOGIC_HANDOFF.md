# Sparter — Business Logic Handoff

Documento di riferimento per ricostruire l'app in un nuovo repo Next.js.
Contiene COSA fa l'app e COME funziona la logica di business, non il codice Express.

---

## Cos'è Sparter

App di personal finance per il mercato italiano. Permette di:
- Importare estratti conto da banche e piattaforme fintech italiane
- Categorizzare automaticamente le spese (regex → storico → AI)
- Visualizzare KPI e dashboard di riepilogo

**Fuori scope v1:** tracking investimenti (azioni, ETF, crypto), AI categorization — rimandati a milestone successive.

---

## Entità principali (schema DB)

### Users
- `email`, `password` (hash bcrypt)
- `firstName`, `lastName`, `jobTitle`, `location`, `phone`, `timezone`
- `avatarUrl`, `membershipLabel`
- `status`: `active | inactive | suspended`
- `subscriptionPlan`: `free | basic | pro`

### Transactions
La singola riga di movimentazione bancaria (raw).
- `amount` DECIMAL(10,2)
- `timestamp` (data della transazione)
- `transactionHash` (dedup: MD5 di amount+description+timestamp)
- `isImportant` (boolean, marcatura manuale)
- `expenseId` FK → Expenses (null se non ancora collegata)
- `fileId` FK → Files (da quale import viene)
- `tags` M2M via TransactionTags

### Expenses
Aggregazione semantica di transazioni con la stessa descrizione normalizzata.
Più transazioni dello stesso tipo (es. "NETFLIX") → una sola Expense.
- `title` (descrizione normalizzata)
- `descriptionHash` (MD5 della descrizione normalizzata — unique per userId)
- `subCategoryId` FK → SubCategories
- `userId`
- `status`:
  - `1` = da categorizzare
  - `2` = auto-categorizzata (regex/history)
  - `3` = categorizzata manualmente
  - `4` = in attesa analisi AI (riservato a milestone v2)
- `confidenceScore` DECIMAL(3,2) — 0.00–1.00
- `categorizationMethod`: `ai | regex | history | manual`
- `sourceFileId` FK → Files

**Relazione chiave:** Transaction → Expense è N:1. Un'expense raggruppa tutte le transazioni con la stessa descrizione.

### Categories & SubCategories
Tassonomia a 2 livelli, seeded nel DB, non modificabile dall'utente.

**Categorie OUT (spese):**
risparmio, abbonamenti, assicurazioni, vacanze, regali, trasporti, spesa, salute, ristorazione, shopping, bollette e utilità, rate e finanziamenti, tasse/imposte/commissioni, famiglia, casa, formazione, libri e media, tempo libero, benessere, bonifici e rimborsi

**Categorie IN (entrate):**
income da lavoro, income finanziari, sconti/rimborsi/cashback, vendite e dismissioni, movimenti di liquidità

**Categorie sistema:**
- `ignore` — transazioni escluse dai calcoli
- `system` — uso interno

Ogni categoria ha: `name`, `slug`, `type` (in/out/system), `icon`, `color`, `displayOrder`, `isActive`.
Ogni subcategoria ha gli stessi campi + `categoryId`.

### Files
Rappresenta un file importato.
- `name` (unique per userId)
- `status`: `pending | processing | done | error`
- `platformId` FK → Platforms
- `userId`
- `storageKey` — path su Cloudflare R2 (es. `uploads/{userId}/{fileId}.csv`)

### Platforms
Configurazione per ogni banca/piattaforma supportata nell'import.
- `name`, `slug`, `version`
- `columnMapping` (JSON) — come mappare le colonne del CSV
- `isDefault`

**Piattaforme supportate attualmente:**
General (generico), Satispay, Intesa SP, Intesa SP Carta Credito, Revolut, Fineco

### Tags
Tag custom creati dall'utente, collegabili alle transazioni.
- `name`, `userId`
- unique su (userId, name)

### CategorizationPatterns
Pattern regex per auto-categorizzazione (seeded + custom per utente).
- `pattern` (TEXT, regex)
- `subCategoryId`
- `userId` (null = pattern globale di sistema)

### ExpenseClassificationHistory
Storico delle categorizzazioni confermate/rifiutate dall'utente.
- `expenseKey` (hash della descrizione normalizzata)
- `subCategoryId`
- `userId`
- `weight` (intero, aumenta ad ogni conferma)

### PendingAiExpense _(schema v1, esecuzione v2)_
Tabella creata in v1 per tenere lo stato AI, ma il batch processor che la svuota arriva in v2.
- `expenseId`
- `status`: `pending | processing | done | error`
- `retryCount`

---

## Pipeline di auto-categorizzazione

Eseguita su ogni expense alla creazione, in sequenza. Si ferma al primo match.

### Tier 1 — Regex patterns
```
CategorizationPatterns WHERE userId IN [userId, null]
→ applica pattern alla descrizione normalizzata
→ se match: assegna subCategoryId, method='regex', confidenceScore=1.0
```

### Tier 2 — History-based
```
ExpenseClassificationHistory WHERE expenseKey = ? AND userId = ?
→ somma weight per subCategory
→ se totalWeight >= 3: assegna subCategoryId, method='history'
```

### Tier 3 — AI _(v2, fuori scope v1)_
- In v1: se nessun match, expense resta in status=1 (da categorizzare manualmente)
- In v2: aggiunge a PendingAiExpense, expense.status=4, processo esterno la risolve
- Il processo AI in v2 richiede un job runner (Trigger.dev o alternativa — da analizzare in v2 con spike dedicato)

### Feature gates per subscription
```
free:  nessuna auto-categorizzazione
basic: regex + history
pro:   regex + history + AI (solo v2)
```

---

## Import file bancari

### Storage: Cloudflare R2
I file CSV/Excel vengono caricati su **Cloudflare R2** (S3-compatible), non su disco locale.
- Upload dal browser → Next.js API route → R2 via SDK `@aws-sdk/client-s3`
- Chiave oggetto: `uploads/{userId}/{fileId}.{ext}`
- Dopo il parsing, il file rimane su R2 per audit (non viene eliminato)
- Variabili env necessarie: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

### Flusso import
1. Upload file → R2, record in `files` table con status=`pending`
2. `analyzeFile()` — scarica da R2, rileva colonne, delimiter, date format
3. `findBestMatchingPlatform()` — confronta colonne con `columnMapping` delle piattaforme → score match
4. Utente conferma la piattaforma (o sceglie manuale)
5. `importFile()`:
   - Per ogni riga: genera `transactionHash` — skip se già esiste (dedup)
   - Normalizza descrizione → genera `descriptionHash`
   - Trova o crea Expense con quel descriptionHash
   - Crea Transaction collegata all'Expense
   - Esegue pipeline categorizzazione (Tier 1 + 2)

### Deduplicazione
- Transaction: unique su `transactionHash` — previene doppi import dello stesso estratto conto
- Expense: unique su `(descriptionHash, userId)` — aggrega transazioni simili

### Column mapping per piattaforma
```json
{
  "description": "Descrizione",
  "amount": { "type": "single", "amount": "Importo" },
  "timestamp": "Data"
}
```
Oppure `type: "split"` con `positiveAmount` e `negativeAmount` separati (es. Fineco).

---

## Dashboard KPI

### `getOverview`
- Preset: `last-month` (default)
- Calcola per mese corrente e precedente: `totalIn`, `totalOut`, `balance`, `savingsRate`, `uncategorizedCount`
- Restituisce delta (variazione %)
- Esclude categoria `ignore` dai calcoli

### `getCategoriesBreakdown`
- Preset o range date custom
- `type`: `in | out | all`
- Totale per categoria + subcategoria + percentuale sul totale

### `getAggregatedTransactionsData`
- Range date libero o preset
- Breakdown mensile: totalIn, totalOut, totalNc (non categorizzato), totalIgnored
- Per ogni mese: breakdown per categoria

> **Nota Drizzle:** queste query usano GROUP BY su più livelli. Con Drizzle si usano `sql` template literals per le aggregazioni complesse — più leggibili e type-safe rispetto a `$queryRaw` di Prisma.

### Presets date disponibili
`last-month` · `last-3-months` · `last-6-months` · `this-year` · `last-year`

---

## Auth & sicurezza

- **NextAuth v5** con Credentials provider (email + password)
- Sessione JWT (stateless) — compatibile con Railway
- **Bypass staging:** header `x-staging-key` bypassa auth in non-produzione — da reimplementare come middleware Next.js
- Password hashata con bcrypt
- Ruoli `admin` / `moderator` — user normale non ha ruolo esplicito

---

## User profile _(implementazione futura, schema v1)_

Campi già presenti su `users` ma gestiti dall'utente in una schermata dedicata:
- Info personali: `firstName`, `lastName`, `jobTitle`, `location`, `phone`, `timezone`
- Avatar: `avatarUrl`
- Notifiche: `notifyEmail`, `notifyPush`, `notifySms`
- Abbonamento: `subscriptionPlan` (readonly per l'utente, gestito da admin)

---

## Arithmetica monetaria

**Regola assoluta:** mai JS `+`, `-`, `*`, `/` su amount. Sempre `Decimal.js`.
```ts
new Decimal(Number(value)).plus(other).toNumber()
parseFloat(d.toFixed(2))  // per JSON response
```
Tutti gli amount: `DECIMAL(10,2)`

---

## Localizzazione

- App in italiano
- Messaggi di errore in italiano + inglese (risolti per `Accept-Language` header)
- Categorie, subcategorie, piattaforme tutte in italiano

---

## Cosa NON portare nel nuovo progetto

- Architettura Express — rimpiazzata da Next.js App Router
- Modelli Sequelize — da riscrivere come schema Drizzle in TypeScript
- Cronjob standalone — il batch AI arriva in v2 con job runner esterno
- Upload su disco locale — sostituito da Cloudflare R2
- Assets e UserAssets — fuori scope v1

---

## Stack

```
Next.js 15 App Router
Drizzle ORM + MySQL (drizzle-kit per migrations)
NextAuth v5 (Credentials provider, JWT session)
Cloudflare R2 (storage file CSV/Excel)
Zod (porta direttamente i validator esistenti)
Decimal.js (porta direttamente)
OpenAI SDK (pronto per v2, non usato in v1)
Tailwind CSS + shadcn/ui (design system)
```

---

## Ordine di sviluppo con GSD

```
v1 — Personal Finance Tracker
```

1. **Design system** — token colore/typo, componenti base (button, input, card, layout shell)
2. **Auth** — signup/login, sessione NextAuth, route protection, bypass staging
3. **Expense management** — CRUD manuale (crea/modifica/categorizza expense), lista con filtri
4. **Dashboard KPI** — overview, breakdown categorie, trend mensile (dati da expense manuali)
5. **Import file bancari** — upload su R2, analisi colonne, matching piattaforma, import transazioni
6. **Import avanzato** — più piattaforme, pattern regex custom, history-based categorization
7. **User profile** — schermata impostazioni account

```
v2 — AI Categorization (milestone separata)
```

- Spike su job runner (Trigger.dev vs alternative) prima di pianificare
- PendingAiExpense batch processor
- Web enrichment per confidence bassa
- Expense status=4 workflow completo
