# Phase 59: import-wizard-attach-format - Research

**Researched:** 2026-06-29
**Domain:** Import wizard UX + service/DAL layer (Next.js 16 App Router, Drizzle ORM, shadcn/ui)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** — Due step client-side, unica route: `ImportFormatWizard` gestisce `currentStep` via `useState`. URL `/import/[fileId]/configure` stabile.
- **D-02** — Lista platform precaricata dalla page RSC: `page.tsx` chiama `listAttachablePlatforms(userId)` server-side e passa il risultato come prop.
- **D-03** — Step 2 mostra il nome della platform come header read-only.
- **D-04** — Voce "Crea nuova platform" sempre in fondo alla lista.
- **D-05** — Campo `platformName` inline nello step 1 (appare quando si seleziona "Crea nuova").
- **D-06** — `existingPlatformId?: number` opzionale su `CreatePrivateImportFormatSchema`; se presente salta l'insert `platform` e usa l'id fornito.
- **D-07** — `listAttachablePlatforms(userId)` in `lib/dal/import-formats.ts`. Query: `platform WHERE reviewStatus = 'approved' OR (reviewStatus = 'pending' AND proposedByUserId = userId)`. Ritorna `{ id, name, slug, reviewStatus }[]`.

### Claude's Discretion

- Ordine platform nella lista (alfabetico per nome o slug).
- Stato iniziale step 1 quando la lista è vuota (DB vergine): salta step 1 o mostra direttamente campo "Crea nuova".
- Esatta UX della riga "Crea nuova platform" (icona, stile radio vs pulsante outline, etc.).

### Deferred Ideas (OUT OF SCOPE)

- Operator approval UI per platform `pending` → `approved`.
- Search/autocomplete nella lista platform.
- Seed slug-linkage e Trade Republic id-8 fix (Phase 60).
- DescriptionStripPattern docs correction (Phase 60).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAT-04 | Quando la detection fallisce, il wizard offre platform esistenti a cui attaccare un nuovo Import Format privato; crea una nuova Platform solo se nessuna combacia, e nasce `pending`. | Implementato tramite D-01..D-07: step 1 UI, `listAttachablePlatforms` DAL, branch `existingPlatformId` in `createPrivateRows`. |
</phase_requirements>

---

## Summary

Phase 59 estende il wizard di configurazione formato (`/import/[fileId]/configure`) da un singolo step a un flusso a due step gestito client-side. Il codice esistente è pulito e ben strutturato: tutte le modifiche avvengono in layer precisi senza cross-cutting.

Il **backend** richiede tre interventi ortogonali: (1) un nuovo campo opzionale `existingPlatformId` nello schema Zod, (2) un branch interno a `createPrivateRows()` che salta l'insert `platform` quando il campo è presente, (3) una nuova funzione DAL `listAttachablePlatforms`. Il frontend aggiunge `currentStep` e `selectedPlatformId` allo stato del componente e renderizza uno step 1 prima dell'attuale form colonne.

La page RSC aggiunge una seconda `await` per precaricare la lista platform e la passa come prop `attachablePlatforms` a `ImportFormatWizard` — esattamente il pattern già usato per il wizard context.

**Raccomandazione primaria:** Implementare nell'ordine DAL → service → action → component → page → test. Nessuna migrazione schema richiesta.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lista platform attachable | Database / DAL | API / Backend | `listAttachablePlatforms` è una query pura; nessuna logica business |
| Branch attach vs create-platform | API / Backend (service) | — | `createPrivateRows` è l'unico punto di fork; mantiene atomicità transazionale |
| Step 1 UI (selezione platform) | Browser / Client | — | D-01: `useState` client-side, zero waterfall, nessuna nuova route |
| Precaricamento lista platform | Frontend Server (RSC) | — | D-02: RSC page esegue la query e passa prop, consistente con il context wizard |
| Validazione `existingPlatformId` | API / Backend (action) | — | `createPrivateImportFormatAction` estrae il campo da FormData prima di passarlo al service |

---

## Standard Stack

Nessun nuovo package richiesto. La fase opera interamente sullo stack esistente.

### Stack esistente rilevante

| Library | Scopo in questa fase |
|---------|---------------------|
| Drizzle ORM (`drizzle-orm`) | Query `listAttachablePlatforms`, branch `existingPlatformId` in `createPrivateRows` |
| Zod (`zod`) | Estensione `CreatePrivateImportFormatSchema` con `.optional()` |
| shadcn/ui (`Card`, `Button`, `Input`, `Alert`) | Già importati in `ImportFormatWizard`; usati per lo step 1 |
| React `useState` | Gestione `currentStep` e `selectedPlatformId` client-side |
| `useActionState` | Invariato; il form action rimane lo stesso |
| `vitest` | Test unitari e di integrazione (framework già configurato) |

**Installation:** nessuna installazione richiesta.

---

## Package Legitimacy Audit

Nessun pacchetto nuovo installato in questa fase.

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| — | — | — | Nessun nuovo package |

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (step 1 client-side)
  │ seleziona platform (radio) o "Crea nuova" + nome
  │ → useState: currentStep='columns', selectedPlatformId=N|'new'
  ▼
Browser (step 2 — layout invariato)
  │ form colonne + hidden input existingPlatformId (se attach)
  │ → useActionState → createPrivateImportFormatAction
  ▼
lib/actions/import.ts
  │ estrae existingPlatformId da FormData (optionalPositiveInteger)
  │ → CreatePrivateImportFormatSchema.safeParse (Zod)
  ▼
lib/services/import-format-wizard.ts
  │ createPrivateImportFormat() → createPrivateRows()
  │   branch A (existingPlatformId presente):
  │     skippa syncPlatformIdSequence + insert platform
  │     insert importFormatVersion con platformId = existingPlatformId
  │   branch B (existingPlatformId assente — comportamento attuale):
  │     syncPlatformIdSequence + insert platform pending
  │     insert importFormatVersion
  │ → update file.status = 'uploaded'
  ▼
Browser: useEffect → router.push(analyze) o completeOnboarding
```

**Precaricamento RSC (D-02):**

```
app/(app)/import/[fileId]/configure/page.tsx (RSC)
  │ await loadImportFormatWizardContextAction(formData)  ← esistente
  │ await listAttachablePlatforms(userId)                ← NUOVO
  │ → <ImportFormatWizard context={...} attachablePlatforms={[...]} from={from} />
```

### Recommended Project Structure

Nessuna nuova directory. I file modificati/creati sono:

```
lib/
├── dal/
│   └── import-formats.ts          # +listAttachablePlatforms (nuova funzione)
├── services/
│   └── import-format-wizard.ts    # +branch existingPlatformId in createPrivateRows
├── validations/
│   └── import.ts                  # +existingPlatformId? su CreatePrivateImportFormatSchema
└── actions/
    └── import.ts                  # +estrazione existingPlatformId da FormData

components/import/
└── import-format-wizard.tsx       # +step 1 UI, nuovo stato

app/(app)/import/[fileId]/configure/
└── page.tsx                       # +listAttachablePlatforms call e prop

tests/
├── import-format-wizard-ui.test.tsx        # estendere con step 1
├── import-format-wizard-actions.test.ts    # estendere con branch attach
└── import-private-formats-dal.test.ts      # estendere con listAttachablePlatforms
```

### Pattern 1: Branch attach vs create-platform in `createPrivateRows`

**Cosa:** Singola funzione con due percorsi interni basati sulla presenza di `existingPlatformId`.

**Dove inserire il fork:**

```typescript
// Source: lib/services/import-format-wizard.ts (codice esistente annotato)
async function createPrivateRows(
  database: DbOrTx,
  input: CreatePrivateImportFormatInput & { userId: string; headers: string[] },
): Promise<CreatePrivateImportFormatResult> {
  const header = headerSignature(input.headers, input.delimiter)

  let resolvedPlatformId: number
  let resolvedPlatformName: string
  let resolvedPlatformSlug: string

  if (input.existingPlatformId !== undefined) {
    // Branch A — attach: niente syncPlatformIdSequence, niente insert platform
    // Occorre recuperare name/slug per il result type (necessario per logging e redirect)
    const [existing] = await database
      .select({ id: platform.id, name: platform.name, slug: platform.slug })
      .from(platform)
      .where(eq(platform.id, input.existingPlatformId))
    if (!existing) {
      throw new ImportFormatWizardError('db_write_failed', 'Piattaforma selezionata non trovata.')
    }
    resolvedPlatformId = existing.id
    resolvedPlatformName = existing.name
    resolvedPlatformSlug = existing.slug
  } else {
    // Branch B — create: comportamento attuale intatto
    const slug = privatePlatformSlug(input)
    await syncPlatformIdSequence(database)
    const [created] = await database
      .insert(platform)
      .values({ proposedByUserId: input.userId, reviewStatus: PENDING_REVIEW_STATUS,
                name: input.platformName!, slug, country: 'IT', isActive: true })
      .returning({ id: platform.id, name: platform.name, slug: platform.slug })
    if (!created) throw new ImportFormatWizardError('db_write_failed', '...')
    resolvedPlatformId = created.id
    resolvedPlatformName = created.name
    resolvedPlatformSlug = created.slug
  }

  // Insert importFormatVersion — invariato, usa resolvedPlatformId
  // ... update file.status = 'uploaded' — invariato
}
```

**Nota critica:** `syncPlatformIdSequence` (righe 126-134 del service) deve essere chiamata SOLO nel branch B. Nel branch A si salta perché non si inserisce nessuna piattaforma. [VERIFIED: codebase grep]

### Pattern 2: `listAttachablePlatforms` in DAL

**Query da implementare (D-07):**

```typescript
// Source: lib/dal/import-formats.ts — da aggiungere
export type AttachablePlatform = {
  id: number
  name: string
  slug: string
  reviewStatus: string
}

export async function listAttachablePlatforms(
  userId: string,
  database: ImportFormatDatabase = db,
): Promise<AttachablePlatform[]> {
  const rows = await database
    .select({
      id: platform.id,
      name: platform.name,
      slug: platform.slug,
      reviewStatus: platform.reviewStatus,
    })
    .from(platform)
    .where(
      and(
        eq(platform.isActive, true),
        or(
          eq(platform.reviewStatus, APPROVED_REVIEW_STATUS),
          and(
            eq(platform.reviewStatus, 'pending'),
            eq(platform.proposedByUserId, userId),
          ),
        ),
      ),
    )
    .orderBy(platform.name)  // ordine alfabetico (Claude's Discretion)

  return rows
}
```

**Colonne disponibili su `platform` (schema.ts righe 255-276):** [VERIFIED: codebase grep]
- `id` (serial, PK)
- `proposedByUserId` (text, nullable, FK → user.id)
- `reviewStatus` (varchar 24, default 'approved')
- `name` (varchar 100)
- `slug` (varchar 100, unique)
- `country` (varchar 2)
- `isActive` (boolean, default true)
- `createdAt`, `updatedAt` (timestamp)

**Indici disponibili:** `platform_slug_idx`, `platform_proposedByUserId_idx`, `platform_reviewStatus_idx` — la query usa `reviewStatus` e `proposedByUserId`, entrambi indicizzati. [VERIFIED: codebase grep]

### Pattern 3: Zod schema — aggiunta `existingPlatformId`

**Modifica a `CreatePrivateImportFormatSchema`:**

```typescript
// Source: lib/validations/import.ts (da modificare)
export const CreatePrivateImportFormatSchema = z
  .object({
    fileId: FileIdSchema,
    // existingPlatformId presente → attach; assente → create-platform (D-06)
    existingPlatformId: z.number().int().positive().optional(),
    // platformName diventa opzionale se existingPlatformId è fornito
    platformName: z
      .string()
      .trim()
      .max(100)
      .optional(),
    // ... campi colonne invariati
  })
  .superRefine((value, ctx) => {
    // Nuova guard: se non si attach, platformName è obbligatorio
    if (value.existingPlatformId === undefined && !value.platformName?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['platformName'],
        message: 'Platform name is required when creating a new platform.',
      })
    }
    // ... superRefine esistente per amountMode invariato
  })
```

**Nota:** `platformName` nell'attuale schema è `required` (`.min(1)`). Con il branch attach diventa opzionale. La superRefine garantisce che sia presente nel branch create. Il type `CreatePrivateImportFormatInput` derivato da `z.infer<>` si aggiorna automaticamente. [VERIFIED: codebase grep]

### Pattern 4: Stato componente wizard — aggiunta step 1

**State shape attuale del componente** (righe 137-147 di `import-format-wizard.tsx`):

```typescript
// Stato attuale (invariato nello step 2)
const [amountMode, setAmountMode] = useState<AmountMode>('single')
const [clientErrors, setClientErrors] = useState<string[]>([])
const [completionError, setCompletionError] = useState<string | null>(null)
const [delimiter, setDelimiter] = useState(context.detectedDelimiter ?? ';')
const [timestampColumn, setTimestampColumn] = useState('')
const [descriptionColumn, setDescriptionColumn] = useState('')
const [amountColumn, setAmountColumn] = useState('')
const [positiveAmountColumn, setPositiveAmountColumn] = useState('')
const [negativeAmountColumn, setNegativeAmountColumn] = useState('')
```

**Nuovo stato da aggiungere per step 1:**

```typescript
type SelectedPlatform = number | 'new' | null  // number = existing id, 'new' = crea nuova
const [currentStep, setCurrentStep] = useState<'platform' | 'columns'>('platform')
const [selectedPlatformId, setSelectedPlatformId] = useState<SelectedPlatform>(null)
// platformName nello step 1 rimane gestito da un input text non-controlled
// (già c'è l'Input name="platformName" nel form; nel branch attach non viene inviato)
```

**Props da aggiungere:**

```typescript
type Props = {
  context: ImportFormatWizardContext
  attachablePlatforms: AttachablePlatform[]   // NUOVO (D-02)
  from?: string
  createAction?: typeof createPrivateImportFormatAction
  completeOnboardingAction?: typeof completeOnboardingPrivateImportAction
}
```

### Pattern 5: Aggiornamento `createPrivateImportFormatAction`

**Come estrarre `existingPlatformId` da FormData:**

```typescript
// Source: lib/actions/import.ts — da modificare
export async function createPrivateImportFormatAction(
  _prev: ImportActionState<CreatePrivateImportFormatResult>,
  formData: FormData,
): Promise<ImportActionState<CreatePrivateImportFormatResult>> {
  const parsed = CreatePrivateImportFormatSchema.safeParse({
    fileId: formData.get("fileId") ?? "",
    existingPlatformId: optionalPositiveInteger(formData, "existingPlatformId"),  // NUOVO
    platformName: formString(formData, "platformName"),  // diventa optional in Zod
    // ... campi invariati
  });
  // ... resto invariato
}
```

`optionalPositiveInteger` è già definita nel file (righe 140-148) e gestisce `undefined` per stringhe vuote — riutilizzabile direttamente. [VERIFIED: codebase grep]

### Pattern 6: Page RSC — aggiunta prop `attachablePlatforms`

```typescript
// Source: app/(app)/import/[fileId]/configure/page.tsx — da modificare
export default async function ConfigureImportFormatPage({ params, searchParams }) {
  const { fileId } = await params
  const resolvedSearch = searchParams ? await searchParams : {}
  const from = Array.isArray(resolvedSearch.from) ? resolvedSearch.from[0] : resolvedSearch.from

  const formData = new FormData()
  formData.set('fileId', fileId)

  // Esistente
  const result = await loadImportFormatWizardContextAction(formData)

  // NUOVO: userId per listAttachablePlatforms
  // Nota: loadImportFormatWizardContextAction chiama verifySession internamente.
  // La page RSC deve chiamare verifySession direttamente per avere userId.
  // Alternativa: creare una server action wrapper o chiamare il DAL via action dedicata.
  // Soluzione raccomandata: aggiungere una action `listAttachablePlatformsAction` che
  // verifica la sessione e chiama il DAL — pattern identico a loadImportFormatWizardContextAction.

  if (result.error || !result.data) { /* error handling invariato */ }

  const platformsResult = await listAttachablePlatformsAction()

  return (
    <ImportFormatWizard
      context={result.data}
      attachablePlatforms={platformsResult.data ?? []}
      from={from}
    />
  )
}
```

**Nota importante:** La page RSC non ha accesso diretto a `userId` senza chiamare `verifySession`. Il pattern stabilito nel progetto è usare server actions che chiamano `verifySession` internamente. Occorre aggiungere `listAttachablePlatformsAction` in `lib/actions/import.ts`. [ASSUMED — alternativa: chiamare verifySession direttamente nella page, ma va verificato se questa è pratica accettata nel progetto]

### Anti-Patterns to Avoid

- **Non chiamare `syncPlatformIdSequence` nel branch attach:** questa funzione serve solo quando si inserisce una platform nuova (workaround per sequenza id). Nel branch A non c'è insert, quindi chiamarla è inutile e potenzialmente confusivo.
- **Non rimuovere il campo `platformName` dal form nello step 2:** nel branch create-platform, `platformName` deve ancora essere inviato. La soluzione più semplice è un hidden input nel form step 2 che porta il nome scelto nello step 1.
- **Non modificare la logica di redirect post-salvataggio:** il `useEffect` che gestisce `createdFormatVersionId` (righe 156-192) funziona identicamente per entrambi i branch — `result.formatVersionId` è sempre valorizzato.
- **Non toccare `validateWizardFields`:** questa funzione ora valida solo lo step 2 (colonne). La validazione dello step 1 è separata (almeno una platform selezionata, o "new" con nome non vuoto).

---

## Don't Hand-Roll

| Problema | Non costruire | Usare invece | Perché |
|----------|--------------|-------------|--------|
| Ordinamento alfabetico lista platform | Sort client-side custom | `.orderBy(platform.name)` in Drizzle | Sfrutta l'indice, zero codice |
| Estrazione `existingPlatformId` da FormData | Parser custom | `optionalPositiveInteger()` già in `import.ts` | Funzione già testata e usata |
| Validazione `existingPlatformId` | Logica ad-hoc nell'action | `z.number().int().positive().optional()` in Zod | Consistente con gli altri campi |

---

## Common Pitfalls

### Pitfall 1: `platformName` obbligatorio nel Zod schema attuale

**Cosa va storto:** L'attuale `CreatePrivateImportFormatSchema` ha `platformName` come required con `.min(1)`. Se si aggiunge `existingPlatformId` senza rendere `platformName` opzionale, il branch attach fallirà la validazione Zod.

**Come evitare:** Rendere `platformName` opzionale (`.optional()`) e aggiungere la guard nella `superRefine` che lo richiede solo quando `existingPlatformId` è assente.

**Warning sign:** Test `import-format-wizard-actions.test.ts` fallirà se la validazione non è aggiornata correttamente.

### Pitfall 2: `validateWizardFields` controlla `platformName`

**Cosa va storto:** `validateWizardFields` (riga 76) controlla `if (!values.platformName.trim())` e aggiunge un errore client-side. Nel branch attach, `platformName` potrebbe essere vuoto (si usa il nome della platform esistente come header read-only, non come input).

**Come evitare:** `validateWizardFields` deve ricevere un flag `isAttach?: boolean` e saltare la validazione di `platformName` se `isAttach === true`. Oppure, popolare un hidden input `platformName` con il nome della platform selezionata prima del submit.

**Soluzione raccomandata:** Hidden input `name="platformName"` valorizzato con il nome della platform scelta dallo step 1 — così `validateWizardFields` passa senza modifiche e il service riceve sempre un nome leggibile nei log. [ASSUMED — valutare in pianificazione]

### Pitfall 3: Lista platform vuota (DB vergine prima del seed)

**Cosa va storto:** Se `listAttachablePlatforms` ritorna `[]`, lo step 1 è inutile — l'utente non ha nessuna platform da scegliere.

**Come evitare:** Quando `attachablePlatforms.length === 0`, inizializzare `currentStep` direttamente a `'columns'` e `selectedPlatformId` a `'new'` — saltare lo step 1. Il campo `platformName` inline appare direttamente.

**Warning sign:** Da documentare nel test — `ConfigureImportFormatPage` deve passare `attachablePlatforms={[]}` e verificare che il wizard renderizzi direttamente lo step 2.

### Pitfall 4: `syncPlatformIdSequence` nel branch attach

**Cosa va storto:** La funzione `syncPlatformIdSequence` (righe 126-134) esegue una query `setval` sulla sequenza `platform_id_seq`. Se chiamata nel branch attach non causa errori, ma è superflua e confonde la tracciabilità.

**Come evitare:** Il fork deve avvenire PRIMA della chiamata a `syncPlatformIdSequence`. Vedi Pattern 1 sopra. [VERIFIED: codebase grep]

### Pitfall 5: `resolvedPlatformName` nel branch attach — SELECT obbligatorio

**Cosa va storto:** `createPrivateRows` ritorna `CreatePrivateImportFormatResult` che include `platformName` e `platformSlug`. Nel branch attach, questi valori non provengono da un insert ma dalla platform esistente.

**Come evitare:** Nel branch attach, fare una SELECT su `platform` per `id`, `name`, `slug` prima di procedere. Il record deve esistere (validato dalla page RSC che ha appena precaricato la lista) ma la query è comunque necessaria per popolare il result type. Aggiungere un throw `ImportFormatWizardError('db_write_failed', ...)` se il record non viene trovato (TOCTOU guard).

### Pitfall 6: Test UI — `validateWizardFields` con piattaforma assente

**Cosa va storto:** Il test esistente `import-format-wizard-ui.test.tsx` verifica che `validateWizardFields({ ...validFields, platformName: '' })` ritorni l'errore sul nome. Con le modifiche, questo test deve continuare a passare nel caso di "crea nuova" ma non nel caso di "attach".

**Come evitare:** Se si aggiunge `isAttach` a `validateWizardFields`, aggiornare il test per coprire entrambi i casi.

---

## Code Examples

### Struttura completa `createPrivateRows` dopo il fork

```typescript
// Linee chiave — vedere Pattern 1 sopra per il codice completo
// Linea critica attuale: await syncPlatformIdSequence(database)  ← solo nel branch B
// Linea critica attuale: await database.insert(platform).values({...})  ← solo nel branch B
// Entrambe le branch convergono su:
//   await database.insert(importFormatVersion).values({ platformId: resolvedPlatformId, ... })
//   await database.update(fileTable).set({ status: 'uploaded', ... })
```

### Stato iniziale wizard con lista vuota

```typescript
// Se attachablePlatforms.length === 0, auto-advance a step 2
const initialStep: 'platform' | 'columns' =
  attachablePlatforms.length === 0 ? 'columns' : 'platform'
const initialPlatformId: SelectedPlatform =
  attachablePlatforms.length === 0 ? 'new' : null

const [currentStep, setCurrentStep] = useState(initialStep)
const [selectedPlatformId, setSelectedPlatformId] = useState(initialPlatformId)
```

### Hidden input per `existingPlatformId` nel form

```tsx
{/* Nel form dello step 2 — aggiunto accanto agli altri hidden inputs */}
{typeof selectedPlatformId === 'number' && (
  <input type="hidden" name="existingPlatformId" value={String(selectedPlatformId)} />
)}
{/* platformName: nel branch attach, popolare con il nome della platform scelta */}
<input
  type="hidden"
  name="platformName"
  value={
    typeof selectedPlatformId === 'number'
      ? (attachablePlatforms.find(p => p.id === selectedPlatformId)?.name ?? '')
      : platformNameInput  // controllato dallo step 1 "Crea nuova"
  }
/>
```

---

## State of the Art

| Vecchio approccio | Approccio attuale | Quando cambiato | Impatto |
|-------------------|------------------|-----------------|---------|
| Wizard sempre crea platform | Wizard propone platform esistenti | Phase 59 | Elimina duplicati platform per banche note |
| `platform.ownerUserId` | `platform.proposedByUserId` | Phase 58 | Schema già aggiornato — nessuna migration in Phase 59 |
| `accessibleWhere` accoppiava formato-privato a platform-privata | Disaccoppiato (PLAT-03, Phase 58) | Phase 58 | Un formato privato su platform approved è già visibile al proprietario |

**Deprecated/outdated:**
- Nessun approccio deprecato introdotto da questa fase. La fase costruisce sul modello PLAT-01..03 già implementato in Phase 58.

---

## Assumptions Log

| # | Claim | Section | Rischio se errato |
|---|-------|---------|-------------------|
| A1 | Nel branch attach, il componente popola un hidden `platformName` con il nome della platform scelta, così `validateWizardFields` passa senza modifiche | Pitfall 2, Code Examples | `validateWizardFields` emetterebbe errore client; lo step 2 non sarebbe submittable nel branch attach |
| A2 | La page RSC aggiunge una server action `listAttachablePlatformsAction` (anziché chiamare `verifySession` direttamente) per coerenza con il pattern esistente | Pattern 6 | Se il progetto accetta `verifySession` direttamente nella page, una action wrapper è superflua |

---

## Open Questions

1. **`validateWizardFields` — modifica o hidden input?**
   - Cosa sappiamo: la funzione controlla `platformName`; nel branch attach il nome viene dalla platform selezionata, non da un input utente.
   - Cosa è incerto: quale approccio il planner preferisce (hidden input vs flag `isAttach`).
   - Raccomandazione: hidden input — zero modifiche a `validateWizardFields`, test esistenti invariati.

2. **`listAttachablePlatformsAction` — action wrapper o chiamata DAL diretta dalla page?**
   - Cosa sappiamo: il progetto usa `lib/actions/` come thin wrapper con `verifySession`; la page RSC chiama `loadImportFormatWizardContextAction`.
   - Cosa è incerto: se una page RSC può chiamare direttamente `verifySession` + DAL senza passare per un'action.
   - Raccomandazione: aggiungere `listAttachablePlatformsAction` in `lib/actions/import.ts` — pattern identico a `loadImportFormatWizardContextAction`, testabile in isolamento.

---

## Environment Availability

Step 2.6: SKIPPED (nessuna dipendenza esterna — la fase opera su file TypeScript e database già disponibile).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest |
| Config file | `vitest.config.ts` (nella root) |
| Quick run command | `yarn test --run tests/import-format-wizard-ui.test.tsx tests/import-format-wizard-actions.test.ts tests/import-private-formats-dal.test.ts` |
| Full suite command | `yarn test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File esiste? |
|--------|----------|-----------|-------------------|-------------|
| PLAT-04-DAL | `listAttachablePlatforms` ritorna approved + own-pending, esclude altrui-pending | unit | `yarn test --run tests/import-private-formats-dal.test.ts` | Parziale — estendere |
| PLAT-04-SVC-ATTACH | `createPrivateRows` branch attach: salta platform insert, usa `existingPlatformId` | unit | `yarn test --run tests/import-format-wizard-actions.test.ts` | Parziale — estendere |
| PLAT-04-SVC-CREATE | `createPrivateRows` branch create: comportamento attuale invariato | unit (regression) | `yarn test --run tests/import-format-wizard-actions.test.ts` | Esistente — non rompere |
| PLAT-04-UI-STEP1 | Step 1 renderizza lista platform + "Crea nuova" | unit | `yarn test --run tests/import-format-wizard-ui.test.tsx` | Parziale — estendere |
| PLAT-04-UI-EMPTY | Lista vuota → step 1 saltato, wizard apre direttamente step 2 | unit | `yarn test --run tests/import-format-wizard-ui.test.tsx` | Mancante |
| PLAT-04-UI-ONBOARDING | Flusso onboarding invariato con step 1 | unit | `yarn test --run tests/import-format-wizard-ui.test.tsx` | Parziale — verificare |
| PLAT-04-ZOD | `existingPlatformId` opzionale, `platformName` opzionale se attach | unit | `yarn test --run lib/validations/__tests__/import.test.ts` | Parziale — estendere |

### Sampling Rate

- **Per task commit:** `yarn test --run tests/import-format-wizard-actions.test.ts`
- **Per wave merge:** `yarn test --run tests/import-format-wizard-ui.test.tsx tests/import-format-wizard-actions.test.ts tests/import-private-formats-dal.test.ts lib/validations/__tests__/import.test.ts`
- **Phase gate:** `yarn test` (full suite) prima di `/gsd-verify-work`

### Wave 0 Gaps

Nessun file di test mancante — tutti i file di test da estendere esistono già. Non servono nuovi file di fixture o setup.

*(Nessuna nuova infrastruttura di test richiesta)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | `listAttachablePlatforms` filtra per `proposedByUserId = userId` — mai esporre platform altrui. `createPrivateRows` branch attach: guard TOCTOU su SELECT platform |
| V5 Input Validation | yes | `existingPlatformId` validato via Zod `.int().positive()`; `platformName` solo nel branch create |
| V2 Authentication | yes | `createPrivateImportFormatAction` chiama `verifySession()` — invariato |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR su `existingPlatformId` | Tampering | La lista platform precaricata dalla page RSC filtra già per accessibilità; il service deve comunque fare un SELECT nel branch attach per TOCTOU guard — non fidarsi solo del client |
| Injection via `platformName` | Tampering | Zod `.trim().max(100)` + parametrizzato da Drizzle |
| Platform injection (attach a platform di un altro utente, pending) | Elevation of Privilege | `accessibleWhere` / `listAttachablePlatforms` escludono platform pending altrui; il branch attach non modifica la platform — solo inserisce un format version con `ownerUserId = userId` |

**Nota critica IDOR:** Il client invia `existingPlatformId`. Il service deve verificare che la platform esista (SELECT) ma NON deve verificare che l'utente possa "attaccarsi" — per ADR 0015 qualsiasi platform `approved` è aperta a tutti, e le `pending` del proponente sono già nella lista filtrata. La guard SELECT serve solo come TOCTOU (la platform potrebbe essere stata disattivata tra il precaricamento RSC e il submit).

---

## Project Constraints (from CLAUDE.md)

| Direttiva | Impatto su Phase 59 |
|-----------|---------------------|
| Decimal.js per importi monetari | Non rilevante (nessun importo monetario in questa fase) |
| Imports in `db.transaction` | `createPrivateRows` già usa `db.transaction` — il branch attach rimane nella stessa transazione |
| Layers: `dal/` → `services/` → `actions/` | Rispettato: `listAttachablePlatforms` in DAL, branch fork nel service, action thin wrapper |
| Mai `drizzle-kit push` in prod | Non rilevante — nessuna migration schema |
| Seeds additive | Non rilevante |
| `yarn check:language` | Eseguire dopo modifiche a commenti/route/developer strings |
| Leggi CONTEXT.md per vocabolario dominio | Vocabolario: Platform (identità globale), Import Format (ownership privata), wizard, attach |
| Next.js 16 App Router | Page RSC usa `params: Promise<{...}>` + `await params` — pattern già presente e corretto |
| Better Auth + session | `verifySession()` nell'action — invariato |

---

## Sources

### Primary (HIGH confidence)

- Codebase: `lib/services/import-format-wizard.ts` — struttura completa `createPrivateRows`, `syncPlatformIdSequence`, `ImportFormatWizardContext`, `CreatePrivateImportFormatResult` [VERIFIED: codebase grep]
- Codebase: `lib/dal/import-formats.ts` — `accessibleWhere`, `ImportFormatDatabase`, pattern di query Drizzle per platform [VERIFIED: codebase grep]
- Codebase: `lib/db/schema.ts` righe 255-276 — colonne tabella `platform` post-Phase-58 [VERIFIED: codebase grep]
- Codebase: `components/import/import-format-wizard.tsx` — state shape, `validateWizardFields`, `readFormValues`, Props type, `SelectField` sub-component [VERIFIED: codebase grep]
- Codebase: `app/(app)/import/[fileId]/configure/page.tsx` — props RSC, pattern caricamento context [VERIFIED: codebase grep]
- Codebase: `lib/actions/import.ts` — `createPrivateImportFormatAction`, `optionalPositiveInteger`, `formString` [VERIFIED: codebase grep]
- Codebase: `lib/validations/import.ts` — `CreatePrivateImportFormatSchema` con `superRefine` [VERIFIED: codebase grep]
- Codebase: `lib/routes.ts` — `APP_ROUTES`, `ONBOARDING_AFTER_PRIVATE_PLATFORM_CREATION_ROUTE` [VERIFIED: codebase grep]
- ADR: `docs/adr/0015-platform-global-moderated-format-private.md` — Platform non è mai user-owned, wizard deve proporre existing prima di creare [VERIFIED: codebase grep]
- ADR: `docs/adr/0013-import-format-owns-parsing-contract.md` — contratto di parsing su `importFormatVersion`, platform è pura identità [VERIFIED: codebase grep]

### Secondary (MEDIUM confidence)

- Test: `tests/import-format-wizard-actions.test.ts` — mock structure per `db.transaction`, pattern per test del branch attach [VERIFIED: codebase grep]
- Test: `tests/import-format-wizard-ui.test.tsx` — test esistenti da preservare e estendere [VERIFIED: codebase grep]
- Test: `tests/import-private-formats-dal.test.ts` — pattern `makeQueryChain` riutilizzabile per `listAttachablePlatforms` [VERIFIED: codebase grep]

---

## Metadata

**Confidence breakdown:**
- DAL query: HIGH — colonne schema verificate, pattern `accessibleWhere` direttamente replicabile
- Service fork: HIGH — codice `createPrivateRows` letto riga per riga, fork point chiaro
- UI step 1: HIGH — state shape esistente compreso, decisioni D-01..D-05 locked
- `validateWizardFields` workaround: MEDIUM — approccio hidden input raccomandato ma non locked
- `listAttachablePlatformsAction` vs chiamata DAL diretta: MEDIUM — pattern stabilito favorisce action wrapper

**Research date:** 2026-06-29
**Valid until:** 2026-07-29 (codebase stabile, nessuna dipendenza esterna)
