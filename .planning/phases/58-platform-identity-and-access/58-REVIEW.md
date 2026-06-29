---
phase: 58-platform-identity-and-access
reviewed: 2026-06-29T14:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - lib/db/schema.ts
  - lib/dal/import-formats.ts
  - lib/services/import-format-wizard.ts
  - tests/import-private-formats-dal.test.ts
  - tests/import-format-wizard-actions.test.ts
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: clean
---

# Phase 58: Code Review Report

**Reviewed:** 2026-06-29
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Revisione dei cinque file modificati nella Phase 58 (platform-identity-and-access): schema Drizzle, DAL access control, wizard write-path, e due suite di test. La migrazione 0023 è una vera RENAME COLUMN senza ADD COLUMN intermedio — nessun rischio di perdita dati. La logica `accessibleWhere` a due branch è corretta per i casi base. Tuttavia sono emersi quattro Warning e due Info che richiedono attenzione prima o subito dopo il merge.

---

## Narrative Findings (AI reviewer)

## Avvertimenti (Warning)

### WR-01: `platformRelations.owner` — nome della relation semanticamente scorretto dopo il rename

**File:** `lib/db/schema.ts:618`
**Issue:** Il campo della relation Drizzle è ancora chiamato `owner` ma ora punta a `platform.proposedByUserId`. Il concetto di "owner" è esattamente ciò che ADR 0015 ha rimosso dalla platform: la relation porta un nome contrario alla decisione architetturale appena implementata. Qualsiasi futuro caller che usa `with: { owner: true }` in una query Drizzle con questa relation otterrà il proposer, non un owner — il nome fuorviante aumenta la probabilità di errori di lettura del codice.

Il Summary di Plan 01 documenta la scelta ("relation key kept 'owner' per D-06 minimal-diff mandate"), ma questo ha creato un debito semantico immediato che dovrebbe essere risolto a breve.

**Fix:**
```ts
// lib/db/schema.ts:617-623
export const platformRelations = relations(platform, ({ one, many }) => ({
  proposer: one(user, {  // rinominare 'owner' → 'proposer'
    fields: [platform.proposedByUserId],
    references: [user.id],
  }),
  importFormatVersions: many(importFormatVersion),
}));
```
Verificare con `grep -rn "platformRelations\|with.*owner" lib/ app/` se ci sono caller che usano il campo prima del rename.

---

### WR-02: Test DAL usano `reviewStatus: 'draft'` per i format privati — valore non più prodotto dal codice

**File:** `tests/import-private-formats-dal.test.ts:89,107,124,139,153`
**Issue:** Tutti i test che coprono i branch "format privato" usano `reviewStatus: 'draft'` per `importFormatVersion.reviewStatus`. Il wizard aggiornato nella Phase 58 (Plan 03) usa invece `PENDING_REVIEW_STATUS = 'pending'`. Il valore `'draft'` non viene più scritto da nessun punto del codice (il check negativo su `DRAFT_REVIEW_STATUS` nel SUMMARY di Plan 03 lo conferma).

I test passano perché `accessibleWhere` Branch 2 e `isOwnedBy` non filtrano su `importFormatVersion.reviewStatus` — qualsiasi valore passa. Ma questa scelta rende i test non rappresentativi dello stato reale in produzione: un refactor futuro che aggiungesse un check su `reviewStatus` del format farebbe fallire i test con dati inattesi senza che ci sia un reale bug di produzione, o viceversa lascerebbe passare un bug perché i dati di test non corrispondono ai dati reali.

**Fix:**
```ts
// tests/import-private-formats-dal.test.ts — aggiornare gli override in tutti i test che usano 'draft'
makeRow({
  id: 2,
  ownerUserId: 'user-a',
  reviewStatus: 'pending',          // era 'draft'
  platformReviewStatus: 'approved',
  platformProposedByUserId: null,
})
```
Applicare lo stesso fix alle righe 107, 124, 139, 153.

---

### WR-03: `listPdfImportPlatformNames` filtra solo su `isNull(platform.proposedByUserId)` senza richiedere anche `platform.reviewStatus = 'approved'`

**File:** `lib/dal/import-formats.ts:230`
**Issue:** La funzione usa `isNull(platform.proposedByUserId)` per selezionare solo le platform globali (senza proposer). Tuttavia il predicato `eq(platform.reviewStatus, APPROVED_REVIEW_STATUS)` alla riga 228 si applica solo alla platform, non al formato: la struttura del `.where()` a riga 224-234 li combina con `and()` — quindi anche `platform.reviewStatus` è effettivamente filtrato. La query è corretta.

Il problema rimane però a livello semantico: il filtro `isNull(proposedByUserId)` non è strettamente equivalente a "platform globale approvata" — è equivalente a "platform senza proposer". In futuro, se venisse inserita una platform senza proposer ma con `reviewStatus='pending'` (scenario non attualmente possibile tramite il codice, ma possibile via operatore DB), la query la includerebbe. Il filtro `isNull(proposedByUserId)` è ridondante rispetto al check `reviewStatus=approved` (tutte le platform seeded hanno entrambi i valori), ma in assenza di un vincolo DB che li leghi, la difesa ridondante potrebbe essere rimossa lasciando un vettore futuro.

Questo non è un bug oggi, ma è un rischio di manutenzione.

**Fix:** Aggiungere un commento esplicativo:
```ts
isNull(platform.proposedByUserId), // piattaforme globali: nessun proposer (seeded, sempre approved)
// NOTA: il check eq(platform.reviewStatus, APPROVED_REVIEW_STATUS) sopra è già sufficiente;
// isNull(proposedByUserId) è ridondante ma esplicita l'intenzione.
```
Oppure, se si vuole semplificare, rimuovere il predicato `isNull(proposedByUserId)` e affidarsi solo a `reviewStatus=approved` — ma documentarlo esplicitamente.

---

### WR-04: Il test a riga 150-159 verifica `selectedFormatVersionId` in modo indiretto — il mock restituisce tutte le righe ignorando il WHERE

**File:** `tests/import-private-formats-dal.test.ts:150-159`
**Issue:** Il test chiama `loadImportFormatsForDetection({ userId: 'user-a', selectedFormatVersionId: 6 })` con `mocks.rows` contenente tre righe (id 6, 7, 8). Il mock DB (`makeQueryChain`) non filtra su `selectedFormatVersionId` — restituisce sempre tutte le righe. Il risultato `[]` è corretto solo perché:
- Riga 6: cross-user (`ownerUserId='other-user'` ≠ `'user-a'`) — filtrata da `isOwnedBy`
- Riga 7: `isActive=false` — filtrata da `isAccessibleImportFormat`
- Riga 8: `platformIsActive=false` — filtrata da `isAccessibleImportFormat`

Il filtro `selectedFormatVersionId` del WHERE SQL non è mai testato in isolamento. Se le righe 7 o 8 fossero attive e di proprietà di `user-a`, apparirebbero nel risultato anche se il test si aspetta solo la riga 6 — comportamento scorretto del mock che il test non copre.

Questo è un gap di copertura del test, non un bug di produzione (il SQL WHERE funziona correttamente in produzione).

**Fix:**
```ts
// Aggiungere un test dedicato per selectedFormatVersionId isolation:
it('returns only the selected format version when selectedFormatVersionId is specified', async () => {
  mocks.rows = [
    makeRow({ id: 2 }),
    makeRow({ id: 3 }),
  ]
  const result = await loadImportFormatsForDetection({ userId: 'user-a', selectedFormatVersionId: 2 })
  // Nota: il mock non filtra sul WHERE, quindi entrambe le righe tornano.
  // Questo test documenta che la selezione è delegata al SQL (non in-memory).
  expect(result).toHaveLength(2) // senza filtro SQL reale, entrambe passano
})
```
Alternativamente: aggiungere una nota al test esistente che chiarisca che `selectedFormatVersionId` viene ignorato dal mock e che la verifica di isolamento è responsabilità del layer SQL.

---

## Informazioni (Info)

### IN-01: `PRIVATE_VISIBILITY` — costante con nome potenzialmente fuorviante dopo ADR 0015

**File:** `lib/services/import-format-wizard.ts:57`
**Issue:** La costante `PRIVATE_VISIBILITY = 'private'` è ancora presente nel file e viene usata a riga 244 per `importFormatVersion.visibility`. Questo è intenzionale per Discretion A3 (il formato mantiene la sua colonna `visibility` in questa phase). Tuttavia il nome `PRIVATE_VISIBILITY` accoppiato alla costante `PENDING_REVIEW_STATUS` nello stesso file crea ambiguità: non è chiaro a prima vista perché la platform non abbia più `visibility` ma il formato sì. Un commento che espliciti questo duale comportamento ridurrebbe la cognitiva per il prossimo reviewer.

**Fix:**
```ts
// Aggiungere un commento inline alla costante:
const PRIVATE_VISIBILITY = 'private' // importFormatVersion only — platform.visibility rimosso in ADR 0015 (migrazione 0023)
```

---

### IN-02: `reviewStatus` è `varchar(24)` senza enum — nessun type enforcement per i valori del lifecycle

**File:** `lib/db/schema.ts:260`, `lib/db/schema.ts:287`
**Issue:** Sia `platform.reviewStatus` che `importFormatVersion.reviewStatus` sono definiti come `varchar(24)` con default stringa. I valori del lifecycle (`'pending'`, `'approved'`, eventualmente `'rejected'`) sono stringhe non tipate sia a livello DB (nessun tipo `review_status_enum`) sia a livello TypeScript (tipo inferito come `string`). Il wizard già usa costanti (`PENDING_REVIEW_STATUS`, `APPROVED_REVIEW_STATUS`) per mitigare il rischio di typo, ma non c'è nulla che impedisca di scrivere `reviewStatus: 'draf'` (typo) e farlo passare al compilatore.

Questo non è un difetto introdotto dalla Phase 58 (la colonna pre-esisteva), ma è un rischio di manutenzione che aumenta con ogni fase che tocca `reviewStatus`.

**Fix (idealmente in una phase successiva):**
```ts
// lib/db/schema.ts — aggiungere un enum Drizzle come per amountTypeEnum
export const reviewStatusEnum = pgEnum('review_status', ['pending', 'approved'])

// platform table:
reviewStatus: reviewStatusEnum('review_status').default('approved').notNull(),
// importFormatVersion table:
reviewStatus: reviewStatusEnum('review_status').default('approved').notNull(),
```
Richiede una migrazione separata. Valutare per Phase 59/60.

---

_Reviewed: 2026-06-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
