---
phase: 59-import-wizard-attach-format
verified: 2026-06-29T15:51:00Z
status: passed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 59: import-wizard-attach-format Verification Report

**Phase Goal:** Trasformare il wizard di configurazione formato in un flusso a due step: step 1 permette all'utente di scegliere una Platform esistente (approved o propria pending) a cui attaccare il nuovo formato privato, oppure di creare una nuova Platform pending; step 2 rimane la configurazione colonne invariata.
**Verified:** 2026-06-29T15:51:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | Step 1 lista le platform attachabili (approved + own-pending, isActive=true, ordinate per nome) | VERIFIED | `listAttachablePlatforms` in `lib/dal/import-formats.ts:227-254` con WHERE `isActive=true AND (approved OR pending/own)` + `.orderBy(platform.name)` — confermato anche da `listAttachablePlatformsAction` e dalla page RSC |
| SC2 | Selezionare una platform esistente attacca il formato senza inserire una nuova riga platform | VERIFIED | Branch attach in `createPrivateRows` (riga 224): salta `syncPlatformIdSequence` e l'insert su `platform`; inserisce solo `importFormatVersion` con `platformId = resolvedPlatformId` — test "attach branch: skips platform insert" passa |
| SC3 | "Crea nuova platform" minta una platform pending solo quando scelta | VERIFIED | Branch create (else path, riga 250): `reviewStatus: PENDING_REVIEW_STATUS`; voce "Crea una nuova platform" sempre visibile in step 1 (riga 294 del wizard) — test "create branch regression: still inserts pending platform" passa |
| SC4 | Il redirect/onboarding flow funziona ancora dopo il salvataggio | VERIFIED | `useEffect` del wizard (righe 170-206) invariato; test "uses onboarding import copy" e "renders step 1 platform list" entrambi verdi |
| SC5 | TOCTOU guard su existingPlatformId replica la visibility rule (isActive + approved-OR-own-pending) | VERIFIED | `createPrivateRows` riga 228-244: SELECT con `isActive=true AND (approved OR (pending AND proposedByUserId=userId))` prima di accettare l'id — test "attach branch: rejects a forged id for another user's pending platform (IDOR fix)" e "throws db_write_failed when platform no longer exists" passano |
| SC6 | Duplicate platform name (case-insensitive) rifiutato nel branch create | VERIFIED | `ilike(platform.name, platformName)` riga 261 nel branch create; `ImportFormatWizardErrorCode.duplicate_platform_name` definito e mappato in `mapImportFormatWizardError` — test "create branch: rejects a platform name that duplicates an existing approved platform" passa |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/dal/import-formats.ts` | `listAttachablePlatforms` + `AttachablePlatform` type | VERIFIED | Righe 207-254: type esportato correttamente; funzione con injectable-db, visibilità ADR-0015, ordinamento per nome |
| `lib/validations/import.ts` | `existingPlatformId` optional field + `superRefine` guard su `platformName` | VERIFIED | Riga 99: `z.number().int().positive().optional()`; riga 117-123: guard che richiede `platformName` solo nel branch create |
| `lib/services/import-format-wizard.ts` | `createPrivateRows` fork (attach vs create-platform) + TOCTOU guard + duplicate name guard | VERIFIED | Righe 219-355: fork su `input.existingPlatformId !== undefined`; TOCTOU SELECT righe 228-244; ilike guard riga 261; log `import_format_wizard.attached` riga 339 |
| `lib/actions/import.ts` | `existingPlatformId` propagato + `listAttachablePlatformsAction` esportata | VERIFIED | Riga 195: `optionalPositiveInteger(formData, 'existingPlatformId')`; riga 236-256: `listAttachablePlatformsAction` con verifySession + DAL call |
| `components/import/import-format-wizard.tsx` | Step 1 UI, `currentStep` / `selectedPlatformId` state, `attachablePlatforms` prop, hidden inputs | VERIFIED | Prop riga 57; stati righe 147-153; step 1 render righe 249-322; hidden `existingPlatformId` riga 351 (condizionale); hidden `platformName` riga 353 |
| `app/(app)/import/[fileId]/configure/page.tsx` | `listAttachablePlatformsAction` chiamata + `attachablePlatforms` prop passata al wizard | VERIFIED | Riga 7 (import), riga 55 (await), riga 68 (prop con fallback `?? []`) |
| `tests/import-private-formats-dal.test.ts` | Coverage per `listAttachablePlatforms` | VERIFIED | 2 nuovi test in `describe('listAttachablePlatforms')`: approved+own-pending e empty array |
| `lib/validations/__tests__/import.test.ts` | 6 nuovi test per `existingPlatformId` opzionale | VERIFIED | Describe "existingPlatformId optional field (Plan 59-02)" con 6 test cases |
| `tests/import-format-wizard-actions.test.ts` | Test attach branch, TOCTOU, IDOR, duplicate name, `listAttachablePlatformsAction` | VERIFIED | 8 nuovi test (attach, TOCTOU, IDOR, duplicate, listAction auth, listAction session, listAction DAL error, create regression) |
| `tests/import-format-wizard-ui.test.tsx` | Step 1 render, empty-list skip, onboarding regression | VERIFIED | 2 nuovi test + test update per ConfigureImportFormatPage |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `configure/page.tsx` | `lib/actions/import.ts` | `listAttachablePlatformsAction()` await a riga 55 | WIRED | Import a riga 7, chiamata a riga 55, result propagato a riga 68 |
| `configure/page.tsx` | `ImportFormatWizard` | prop `attachablePlatforms={platformsResult.data ?? []}` a riga 68 | WIRED | Fallback `[]` su errore DAL (create-new mode) |
| `ImportFormatWizard` | form submit | hidden inputs `existingPlatformId` (condizionale) e `platformName` (sempre) | WIRED | Righe 350-353; `validateWizardFields` legge `platformName` da FormData invariato |
| `createPrivateImportFormatAction` | `createPrivateImportFormat` service | `existingPlatformId: optionalPositiveInteger(...)` nel safeParse a riga 195 | WIRED | Propagato via `{ ...parsed.data, userId }` a riga 223 |
| `createPrivateRows` fork | `importFormatVersion` insert | `platformId: resolvedPlatformId` riga 297 | WIRED | Entrambi i branch convergono su `resolvedPlatformId` prima dell'insert |
| `listAttachablePlatformsAction` | `listAttachablePlatforms` DAL | `userId` da `verifySession` (mai dal client) | WIRED | Righe 237-249 in `lib/actions/import.ts` |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Tutti i test della fase | `yarn test --run tests/import-private-formats-dal.test.ts tests/import-format-wizard-actions.test.ts tests/import-format-wizard-ui.test.tsx lib/validations/__tests__/import.test.ts` | 58 passed (4 test files), 506ms | PASS |
| TypeScript — file phase-59 | `yarn tsc --noEmit 2>&1 \| grep -E '...'` | 0 errori nei file della fase | PASS |
| Errori TS pre-esistenti | `yarn tsc --noEmit` | 14 errori in cascade-options.test.ts, category-combobox.test.tsx, overview-interactions.test.tsx, suggestion-card.test.tsx — tutti pre-esistenti e fuori scope | INFO |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PLAT-04 | 59-01, 59-02, 59-03 | Wizard offre platform esistenti prima di crearne una nuova; attach reusa; create minta pending | SATISFIED | SC1..SC4 verificati via codice + test suite |

---

### Anti-Patterns Found

Nessun debt marker (TBD, FIXME, XXX, TODO, HACK, PLACEHOLDER) nei file modificati dalla fase.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | Nessuno |

---

### Human Verification Required

Nessun item richiede verifica umana. Tutti i behavior-dependent truths sono coperti da test unitari che passano.

---

### Gaps Summary

Nessun gap. Tutti e 6 i criteri di successo sono verificati nel codice e nei test.

---

### Notes

- Il commit `233f5be fix(59): IDOR guard + duplicate platform name check` non è menzionato nei SUMMARY file (aggiunti dopo la code review) ma è presente nel codebase ed è ciò che implementa SC5 (TOCTOU con visibilità completa) e SC6 (duplicate name guard con `ilike`). Entrambe le funzionalità risultano pienamente implementate e testate.
- I 14 errori TypeScript esistenti riguardano esclusivamente test file pre-esistenti (cascade-options, category-combobox, overview-interactions, suggestion-card) — non introdotti da questa fase.

---

_Verified: 2026-06-29T15:51:00Z_
_Verifier: Claude (gsd-verifier)_
