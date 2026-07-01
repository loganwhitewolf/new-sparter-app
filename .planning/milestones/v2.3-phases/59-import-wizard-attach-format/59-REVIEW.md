---
phase: 59
status: findings
critical: 1
warning: 2
info: 2
---

## Code Review — Phase 59

### Summary

Il flusso a due step è implementato correttamente nella maggior parte delle sue parti: la nuova DAL `listAttachablePlatforms`, il branch Zod `existingPlatformId`, il passaggio RSC → wizard. Un difetto di autorizzazione nel branch attach di `createPrivateRows` lascia però aperto un IDOR: qualsiasi utente autenticato può associare il proprio formato privato a qualunque platform del DB (incluse quelle inattive o `pending` di altri utenti) semplicemente forgiando il FormData. Tutti gli altri difetti sono di gravità inferiore.

---

### Findings

---

#### CRITICAL — IDOR nel branch attach: `existingPlatformId` non è verificato contro l'access scope dell'utente

**File:** `lib/services/import-format-wizard.ts:224-233`

**Issue:**
Nel branch attach di `createPrivateRows`, il SELECT sulla platform usa soltanto `eq(platform.id, input.existingPlatformId)`, senza nessun controllo su `isActive`, `reviewStatus` o `proposedByUserId`:

```typescript
const rows = await database
  .select({ id: platform.id, name: platform.name, slug: platform.slug })
  .from(platform)
  .where(eq(platform.id, input.existingPlatformId))   // <-- solo id, nessun guard
```

`existingPlatformId` arriva dalla FormData di `createPrivateImportFormatAction` attraverso `optionalPositiveInteger`, supera la validazione Zod (solo `int().positive()`) e raggiunge il service senza ulteriore verifica. Questo consente a un utente autenticato di:
1. Attaccare il proprio formato a una platform `isActive = false` (esclusa dal flusso normale).
2. Attaccare il proprio formato alla platform `pending` di un altro utente (che per ADR 0015 deve essere invisibile ai non-proponenti) — disclosure del nome e dello slug di quella platform nel campo `CreatePrivateImportFormatResult.platformName/platformSlug` restituito all'azione.
3. Scoprire per enumerazione quali ID di platform esistono nel DB.

La lista mostrata nello step 1 è correttamente filtrata da `listAttachablePlatforms`, ma il write path non replica quelle condizioni: le guardie UI e quelle server devono essere indipendenti.

**Fix:**
Aggiungere al WHERE dello stesso filtro che usa `listAttachablePlatforms`, passando `input.userId` già disponibile nello scope:

```typescript
// lib/services/import-format-wizard.ts — attach branch SELECT
const rows = await database
  .select({ id: platform.id, name: platform.name, slug: platform.slug })
  .from(platform)
  .where(
    and(
      eq(platform.id, input.existingPlatformId),
      eq(platform.isActive, true),
      or(
        eq(platform.reviewStatus, APPROVED_REVIEW_STATUS),
        and(
          eq(platform.reviewStatus, PENDING_REVIEW_STATUS),
          eq(platform.proposedByUserId, input.userId),
        ),
      ),
    ),
  )

const existing = rows[0]
if (!existing || typeof existing.id !== 'number') {
  // Platform non trovata o non accessibile — usa un codice distinto da db_write_failed
  throw new ImportFormatWizardError(
    'db_write_failed',
    'La piattaforma selezionata non è più disponibile. Riprova.',
  )
}
```

---

#### WARNING — `validateWizardFields` valida `platformName` anche in modalità attach

**File:** `components/import/import-format-wizard.tsx:80`

**Issue:**
`validateWizardFields` esegue sempre il check:
```typescript
if (!values.platformName.trim()) errors.push('Inserisci il nome della piattaforma.')
```
La funzione non riceve alcun parametro che indichi se siamo in modalità attach (dove `platformName` è il nome esistente propagato via hidden input) o create-new. In produzione funziona perché `resolvedPlatformName` è non-vuoto quando la platform è trovata in `attachablePlatforms`, ma ci sono due problemi reali:

1. **Edge case UX:** se per qualsiasi motivo `selectedPlatform` non viene trovato nel find (riga 222 del componente) e `resolvedPlatformName` diventa `''`, l'utente vede "Inserisci il nome della piattaforma" pur non avendo mai visto un campo nome — la piattaforma era già selezionata con il radio button.
2. **Test reliability:** la funzione è esportata. Un test che la chiami in modalità attach omettendo `platformName` (correttamente, perché irrilevante) riceverà un falso positivo.

**Fix:**
Aggiungere un terzo parametro opzionale e saltare il check del nome quando la platform è già selezionata:

```typescript
export function validateWizardFields(
  values: WizardFieldValues,
  headers: readonly string[],
  isExcel = false,
  existingPlatformId?: number,   // <-- nuovo parametro
) {
  const errors: string[] = []
  // ...
  if (existingPlatformId === undefined && !values.platformName.trim()) {
    errors.push('Inserisci il nome della piattaforma.')
  }
  // ...
}
```

Aggiornare il call site in `handleSubmit`:
```typescript
const errors = validateWizardFields(
  readFormValues(event.currentTarget),
  context.headers,
  isExcel,
  typeof selectedPlatformId === 'number' ? selectedPlatformId : undefined,
)
```

---

#### WARNING — `optionalPositiveInteger` restituisce `NaN` invece di `undefined` per input non-intero non vuoto

**File:** `lib/actions/import.ts:140-148`

**Issue:**
```typescript
function optionalPositiveInteger(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") return undefined;

  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0
    ? numericValue
    : Number.NaN;          // <-- sentinel anomalo
}
```
Per un input non vuoto ma non intero valido (es. `"abc"`, `"1.5"`, `"-3"`), la funzione restituisce `NaN` invece di `undefined`. Zod intercetta `NaN` su `z.number().int().positive()` e l'azione ritorna l'errore generico — il comportamento visibile all'utente è corretto — ma il valore sentinella è incoerente: il chiamante non può distinguere "campo assente" da "campo malformato" senza confrontare contro `NaN` (confronto che in JS richiede `Number.isNaN`, non `=== NaN`). Restituire `undefined` in entrambi i casi produce la stessa validazione Zod con semantica più chiara.

**Fix:**
```typescript
function optionalPositiveInteger(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== 'string' || value.trim() === '') return undefined

  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : undefined
}
```

---

#### INFO — Doppia emissione di log nel branch attach

**File:** `lib/services/import-format-wizard.ts:314` e `:363`

**Issue:**
Nel branch attach vengono emessi due eventi di log in sequenza:
- `import_format_wizard.attached` (riga 314, dentro `createPrivateRows`, solo per attach)
- `import_format_wizard.created` (riga 363, dentro `createPrivateImportFormat`, sempre)

Il branch create-new emette solo `import_format_wizard.created`. L'asimmetria fa sì che alert o metriche basate su `created` contino doppio nel path attach, o che alert su `attached` non abbiano corrispondenza in `created` se in futuro il secondo log viene rimosso.

**Fix:**
Scegliere una delle due strategie e applicarla con coerenza:
- Emettere un unico evento `import_format_wizard.created` con un campo `mode: 'attach' | 'create'` nel payload, rimuovendo l'evento `attached` interno.
- Oppure rimuovere l'evento `created` per il branch attach (aggiungendo un `else` nell'if a riga 363).

---

#### INFO — `visibility` proiettata ma non usata nei filtri in-memory di `loadImportFormatsForDetection`

**File:** `lib/dal/import-formats.ts:19, 52, 176`

**Issue:**
`ImportFormatRow.visibility` (riga 19) è proiettata nel SELECT (riga 176: `importFormatVersion.visibility`) e richiesta dalla shape guard (riga 52: `typeof row.visibility === 'string'`). Le funzioni `isGlobalApproved`, `isOwnedBy` e `isAccessibleImportFormat` non la consultano mai — l'accesso è governato da `ownerUserId`, `reviewStatus` e `platformReviewStatus`. Il campo è quindi SQL overhead + noise nel type system. La colonna esiste ancora sullo schema (usata per l'INSERT in `createPrivateRows`), quindi non va rimossa dallo schema; va rimossa dalla projection e dalla shape guard se non ci sono consumer downstream che la leggono.

**Fix (cleanup):**
Rimuovere `visibility` dalla SELECT projection, dal type `ImportFormatRow`, e dal check in `hasExpectedRowShape`. Verificare che nessun consumer di `ImportFormatCandidateInput` dipenda dal campo (in `toCandidate` non è incluso, quindi è sicuro).

---

### Verdict

**Needs fixes** — il CRITICAL (IDOR nel branch attach) deve essere risolto prima del merge. I due WARNING sono correzioni semplici da abbinare alla stessa sessione. I due INFO sono cleanup raccomandati ma non bloccanti.

---

_Reviewed: 2026-06-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Files reviewed: 6_
_Files reviewed list:_
  - lib/dal/import-formats.ts
  - lib/validations/import.ts
  - lib/services/import-format-wizard.ts
  - lib/actions/import.ts
  - components/import/import-format-wizard.tsx
  - app/(app)/import/[fileId]/configure/page.tsx

---

---
phase: 59
plan: 04
status: issues-found
reviewed_files:
  - components/import/import-format-wizard.tsx
  - tests/import-format-wizard-ui.test.tsx
---

## Code Review — Phase 59, Plan 04 (isDuplicateName gap closure)

### Summary

La logica `isDuplicateName` e il gate `step1CanAdvance` sono implementati correttamente per il caso base. Due warning: il messaggio dell'hint non nomina la piattaforma corrispondente (deviazione dalla `<behavior>` spec del piano) e il path `isDuplicateName=true` non è coperto da nessun test automatizzato per limitazione strutturale di `renderToStaticMarkup` con componenti `useState`.

---

### Findings

---

#### Critical

None.

---

#### Warning

**WR-01 — Hint message non nomina la piattaforma duplicata (deviazione dalla spec `<behavior>`)**

**File:** `components/import/import-format-wizard.tsx:317-319`

**Issue:**
La sezione `<behavior>` del plan 04 specifica esplicitamente: _"An inline hint paragraph is rendered below the Input when isDuplicateName is true, **naming the matching platform** so the user knows to select it from the list instead."_ L'implementazione mostra solo il messaggio generico:

```
Esiste già una piattaforma con questo nome. Selezionala dalla lista sopra.
```

Il nome della piattaforma corrispondente non è incluso nel testo. L'utente con molte piattaforme nella lista potrebbe non individuare subito quale sia il duplicato — la spec richiedeva questa informazione esplicitamente per ridurre la frizione UX.

(Nota: la sezione `<action>` del piano riporta il messaggio senza il nome, in contraddizione con `<behavior>`. L'implementazione ha seguito `<action>`, ma il requisito UAT originale e la `<behavior>` section sono più autorevoli per la feature completa.)

**Fix:**
Estrarre il nome della piattaforma corrispondente e includerlo nel messaggio:

```tsx
// Aggiungere nella sezione computed values (riga ~230)
const duplicatePlatform = selectedPlatformId === 'new'
  ? attachablePlatforms.find(
      (p) => p.name.toLowerCase() === platformNameInput.trim().toLowerCase(),
    )
  : undefined

// Aggiornare isDuplicateName
const isDuplicateName = duplicatePlatform !== undefined

// Aggiornare il messaggio (riga 317-319)
{isDuplicateName && (
  <p className="text-xs text-destructive" role="alert">
    Esiste già una piattaforma con questo nome ({duplicatePlatform!.name}). Selezionala dalla lista sopra.
  </p>
)}
```

---

**WR-02 — Path `isDuplicateName=true` non testato: nessun test verifica la visibilità dell'hint nel markup**

**File:** `tests/import-format-wizard-ui.test.tsx`

**Issue:**
La feature principale del plan 04 è che il testo `"Esiste già una piattaforma con questo nome"` appaia nel markup quando `isDuplicateName` è `true`. Nessun test del file verifica questa asserzione positiva. I test aggiunti coprono solo:
- Il pulsante disabled nel render iniziale (stato `platformNameInput=''`, `isDuplicateName` sempre `false`)
- L'assenza dell'hint quando `attachablePlatforms=[]` (no-false-positive)
- La validazione server-side `validateWizardFields` (ortogonale)

La limitazione è strutturale: `renderToStaticMarkup` esegue solo il render iniziale e non può simulare input dell'utente (`useState` inizializzato a `''`). Il path positivo (`isDuplicateName=true`) richiede `@testing-library/react` con `userEvent.type` oppure un refactoring che esponga `isDuplicateName` come prop controllata per i test.

**Fix (opzione A — raccomandata, minimal):**
Estrarre `isDuplicateName` come prop opzionale iniettabile per i test:

```tsx
type Props = {
  // ...existing props...
  _testIsDuplicateName?: boolean  // test-only override
}

// Nel componente:
const isDuplicateName =
  props._testIsDuplicateName ??
  (selectedPlatformId === 'new' &&
    attachablePlatforms.some(
      (p) => p.name.toLowerCase() === platformNameInput.trim().toLowerCase(),
    ))
```

Aggiungere nel test:

```tsx
it('shows duplicate-name hint and disables Continua when isDuplicateName is true', () => {
  const html = renderToStaticMarkup(
    createElement(ImportFormatWizard, {
      context,
      attachablePlatforms: samplePlatforms,
      _testIsDuplicateName: true,
    }),
  )
  expect(html).toContain('Esiste già una piattaforma con questo nome')
  expect(html).toContain('disabled')
})
```

**Fix (opzione B):**
Migrare i test a `@testing-library/react` + `userEvent` per testare il comportamento dinamico reale senza prop di test.

---

#### Info

**IN-01 — Stringa UI "nuova platform" non tradotta (preesistente)**

**File:** `components/import/import-format-wizard.tsx:301`

**Issue:**
`"+ Crea una nuova platform"` — "platform" è inglese. Il progetto usa l'italiano per tutte le superfici utente. L'issue è preesistente al plan 04 ma è presente nei file modificati.

**Fix:**
```tsx
<span className="font-medium">+ Crea una nuova piattaforma</span>
```

---

**IN-02 — Nessun test per la scomparsa dell'hint dopo correzione del nome**

**File:** `tests/import-format-wizard-ui.test.tsx`

**Issue:**
Il piano specifica: _"The duplicate warning disappears as soon as the input no longer collides."_ Questo comportamento dinamico non è coperto da nessun test. È correlato alla stessa limitazione strutturale di WR-02 (render statico), ma vale la pena tracciarlo separatamente come gap di coverage per futura migrazione a `@testing-library/react`.

**Fix:**
Aggiungere al backlog di coverage quando i test vengono migrati a `@testing-library/react`:
```tsx
it('hides duplicate-name hint when name is changed to non-colliding value', async () => {
  // userEvent.type → 'fineco' → hint visible
  // userEvent.clear + userEvent.type → 'MioBank' → hint hidden
})
```

---

### Verdict

**Issues found** — nessun CRITICAL. I due WARNING (WR-01: messaggio senza nome piattaforma; WR-02: path positivo non testato) dovrebbero essere risolti prima del merge per rispettare la spec e la coverage. I due INFO sono cleanup raccomandati.

---

_Reviewed: 2026-06-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Files reviewed: 2 (plan 04 scope)_
_Files reviewed list:_
  - components/import/import-format-wizard.tsx
  - tests/import-format-wizard-ui.test.tsx
