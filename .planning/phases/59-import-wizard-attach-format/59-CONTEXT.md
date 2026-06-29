# Phase 59: import-wizard-attach-format - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Il wizard di configurazione formato (route `/import/[fileId]/configure`) attualmente crea sempre una nuova Platform + ImportFormatVersion quando la detection fallisce. Phase 59 lo trasforma in un flusso a due step:

- **Step 1 (nuovo):** l'utente sceglie su quale Platform attaccare il nuovo formato privato — lista di platform esistenti (approved + proprie pending), con un'opzione "Crea nuova platform" in fondo alla lista. Se sceglie "Crea nuova", compare inline un campo Input per il nome.
- **Step 2 (invariato nel layout):** configurazione colonne del formato (delimiter, timestamp, description, amount) — identico all'attuale wizard. Mostra in testata il nome della platform scelta (read-only) per feedback visivo.

**Cosa NON cambia:** la route `/import/[fileId]/configure`, la logica di colonne, la route di redirect post-salvataggio, il flusso onboarding.

**Cosa cambia nel backend:** `createPrivateImportFormat()` aggiunge un campo opzionale `existingPlatformId`; se presente crea solo `importFormatVersion` senza toccare `platform`; se assente crea platform (`pending`) + formato.

</domain>

<decisions>
## Implementation Decisions

### Wizard UX structure (Step 1 + Step 2)
- **D-01 — Due step client-side, unica route:** Il componente `ImportFormatWizard` gestisce `currentStep` internamente via `useState`. Nessuna nuova route. URL `/import/[fileId]/configure` rimane stabile.
- **D-02 — Lista platform precaricata dalla page RSC:** `app/(app)/import/[fileId]/configure/page.tsx` esegue la query `listAttachablePlatforms(userId)` server-side e passa il risultato come prop al wizard. Zero waterfall client-side, consistente con come viene già caricato il `WizardContext`.
- **D-03 — Step 2 mostra il nome della platform come header read-only:** Quando l'utente ha scelto una platform esistente (attach), lo step 2 apre con "Configura il formato per **[NomePlatform]**". Nessun campo input per il nome.

### Entry point "crea nuova platform"
- **D-04 — Voce "Crea nuova platform" sempre in fondo alla lista:** Lo step 1 elenca le platform esistenti con radio buttons; in fondo, separata visivamente, una riga `+ Crea una nuova platform`. Sempre visibile, indipendentemente da quante platform ci siano.
- **D-05 — Campo platformName inline nello step 1:** Selezionando "Crea nuova platform", compare inline sotto la riga un `Input` per il nome della platform. Lo step 2 non varia struttura in base al percorso scelto.

### Backend
- **D-06 — Un parametro opzionale `existingPlatformId`:** `CreatePrivateImportFormatSchema` (Zod) aggiunge `existingPlatformId?: number`. Se presente → `createPrivateRows()` salta l'insert `platform` e usa l'id fornito; se assente → comportamento attuale (insert platform `pending` + importFormatVersion). Una funzione, due branch interni.
- **D-07 — `listAttachablePlatforms(userId)` in `lib/dal/import-formats.ts`:** Nuova funzione nello stesso file dove vive `accessibleWhere`. Query: `platform WHERE reviewStatus = 'approved' OR (reviewStatus = 'pending' AND proposedByUserId = userId)`. Ritorna `{ id, name, slug, reviewStatus }[]`.

### Claude's Discretion
- Ordine delle platform nella lista (alfabetico per nome o per slug): lasciato al planner.
- Stato iniziale dello step 1 quando la lista è vuota (es. DB vergine prima del seed): comportamento edge — lasciato al planner (probabilmente salta step 1 o mostra direttamente il campo "Crea nuova").
- Esatta UX della riga "Crea nuova platform" (icona, stile radio vs pulsante outline, etc.): lasciato al planner.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ADRs (decisioni locked)
- `docs/adr/0015-platform-global-moderated-format-private.md` — Platform non è mai user-owned; wizard deve proporre platform esistenti prima di crearne una nuova; nuova platform nasce `pending`.
- `docs/adr/0013-import-format-owns-parsing-contract.md` — Il parsing contract vive su `importFormatVersion`, non su `platform`.

### Codice wizard esistente (punto di partenza)
- `lib/services/import-format-wizard.ts` — `createPrivateRows()` (funzione da modificare per D-06), `loadImportFormatWizardContext()` (invariata), `ImportFormatWizardContext` type.
- `components/import/import-format-wizard.tsx` — Componente da estendere con step 1; `validateWizardFields()` e `readFormValues()` (step 2, da preservare).
- `app/(app)/import/[fileId]/configure/page.tsx` — Page RSC da estendere con la call a `listAttachablePlatforms`.
- `lib/actions/import.ts` — `createPrivateImportFormatAction` e `loadImportFormatWizardContextAction` (azioni da aggiornare con `existingPlatformId`).

### DAL access esistente (pattern di riferimento per D-07)
- `lib/dal/import-formats.ts:124-154` — `accessibleWhere(userId, ...)`: stessa logica di visibilità che D-07 replica per la lista platform candidates.
- `lib/db/schema.ts:254-276` — Schema `platform` post-Phase-58: colonne `proposedByUserId`, `reviewStatus`, `name`, `slug`, `country`, `isActive`.

### Validazione
- `lib/validations/import.ts` — `CreatePrivateImportFormatSchema` da estendere con `existingPlatformId?: number`.

### Flussi di redirect (da preservare)
- `lib/routes.ts` — `APP_ROUTES.import`, `ONBOARDING_AFTER_PRIVATE_PLATFORM_CREATION_ROUTE`.
- `app/(app)/import/[fileId]/configure/page.tsx` — Redirect post-salvataggio verso analyze, già gestito nel componente.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ImportFormatWizard` component: già client-side con `useActionState`, `useState` per i valori di Select. Estenderlo con `currentStep: 'platform' | 'columns'` e `selectedPlatformId: number | 'new' | null`.
- `SelectField` (subcomponent interno al wizard): usabile anche per la lista platform nello step 1 se si preferisce un Select, ma D-04 decide radio button — potrebbe richiedere un nuovo sub-component `PlatformList`.
- `Card`, `Alert`, `Button`, `Input`, `Select` (shadcn): già importati nel wizard, disponibili per step 1.
- `APP_ROUTES` da `lib/routes.ts`: già usato per i link "torna alle importazioni".

### Established Patterns
- Page RSC carica context + passa prop: pattern già usato per `loadImportFormatWizardContextAction` → da replicare per `listAttachablePlatforms`.
- `DbOrTx` type per transazioni: `createPrivateRows()` già lo usa; il branch "solo format" deve accettare lo stesso tipo.
- `onConflictDoNothing` non usato qui (wizard non è idempotente), ma `syncPlatformIdSequence` è chiamata dentro `createPrivateRows` — nel branch attach (D-06) va saltata.
- Logging strutturato via `logWizard()`: mantenere per entrambi i branch (aggiungere event `import_format_wizard.attached`).

### Integration Points
- `app/(app)/import/[fileId]/configure/page.tsx` (page RSC): aggiunge una seconda await per la lista platform e la passa al `ImportFormatWizard` come prop `attachablePlatforms`.
- `lib/actions/import.ts` → `createPrivateImportFormatAction`: aggiunge `existingPlatformId` alla FormData → Zod → service.
- `lib/services/import-format-wizard.ts` → `createPrivateImportFormat()`: punto di fork tra branch attach e branch create-platform.

</code_context>

<specifics>
## Specific Ideas

- Il caso comune secondo ADR 0015 è "banca nota, tracciato rielaborato (es. Fineco esportato e rimaneggiato in Excel)" → l'utente sceglie Fineco dalla lista e attacca un formato privato. La nuova piattaforma nasce solo per banche non presenti nel seed.
- L'onboarding flow (from = 'onboarding') deve restare funzionante anche col wizard a due step: il comportamento post-salvataggio (chiamata a `completeOnboardingAction`) non cambia, è nello step 2.
- `syncPlatformIdSequence` (workaround per sequenza id) nel branch attach (D-06) deve essere skippata — non si inserisce nessuna platform.

</specifics>

<scope_fence>
## Scope Fence

**IN scope (Phase 59 / PLAT-04):**
- Step 1 wizard: lista platform candidates + entry "Crea nuova platform" con campo nome inline.
- Step 2 wizard: invariato nel layout, aggiunge header platform read-only.
- `createPrivateImportFormat()` + Zod schema: aggiunta `existingPlatformId` opzionale; branch attach vs create-platform.
- `listAttachablePlatforms(userId)` in `lib/dal/import-formats.ts`.
- Aggiornamento `page.tsx` per caricare e passare la lista platform.
- Aggiornamento `createPrivateImportFormatAction` per propagare `existingPlatformId`.

**OUT of scope — Phase 60 (PLAT-05, PLAT-06):**
- Seed slug-linkage (nessun `id:` esplicito nelle platform seedate, Trade Republic id-8 collision fix).
- DescriptionStripPattern glossary/comment correction.

**OUT of scope (deferred):**
- Operator approval UI per platform `pending` → `approved`.
- Search/filter nella lista platform (se la lista resta < 20 entry per single-user, non serve).

</scope_fence>

<success_criteria>
## Success Criteria (da ROADMAP Phase 59)

1. Su detection fallita, il wizard offre all'utente le Platform esistenti a cui attaccare un nuovo Import Format privato, invece di creare sempre una nuova Platform.
2. Attaccare un formato privato a una Platform known/approved (es. Fineco) riusa quella Platform — nessuna riga duplicata.
3. Una nuova Platform è creata solo quando nessuna esistente combacia, e nasce con `reviewStatus = pending` (visibile solo al proponente).
4. Il nuovo Import Format privato creato (su platform esistente o nuova) è immediatamente usabile dal proprietario per l'import che ha innescato la creazione.

</success_criteria>

<deferred>
## Deferred Ideas

- **Operator approval UI** → dopo che esiste un secondo utente (deferred by ADR 0015).
- **Search/autocomplete nella lista platform** → non necessario per single-user con < 20 platform.
- **Seed slug-linkage e Trade Republic id-8 fix** → Phase 60 (PLAT-05).
- **DescriptionStripPattern docs correction** → Phase 60 (PLAT-06).

</deferred>

---

*Phase: 59-import-wizard-attach-format*
*Context gathered: 2026-06-29*
