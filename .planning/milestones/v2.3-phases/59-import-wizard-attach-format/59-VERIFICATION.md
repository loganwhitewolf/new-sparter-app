---
phase: 59-import-wizard-attach-format
verified: 2026-06-30T11:48:00Z
status: passed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 6/6
  gaps_closed:
    - "isDuplicateName client guard on step-1 create-new input (plan 59-04)"
    - "Inline hint paragraph with role=alert when duplicate name detected (plan 59-04)"
    - "step1CanAdvance gates on !isDuplicateName (plan 59-04)"
  gaps_remaining: []
  regressions: []
---

# Phase 59: import-wizard-attach-format Verification Report

**Phase Goal:** Quando la detection fallisce all'upload, il wizard offre all'utente Platform esistenti a cui attaccare il nuovo formato privato; una nuova Platform viene creata solo se nessuna si adatta ed è born `pending`. Step 1 include guard client-side per nomi duplicati.
**Verified:** 2026-06-30T11:48:00Z
**Status:** PASSED
**Re-verification:** Yes — dopo completamento piano 59-04 (isDuplicateName gap closure)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | Step 1 lista le platform attachabili (approved + own-pending, isActive=true, ordinate per nome) | VERIFIED | `listAttachablePlatforms` in `lib/dal/import-formats.ts:227-254` con WHERE `isActive=true AND (approved OR pending/own)` + `.orderBy(platform.name)` — confermato da `listAttachablePlatformsAction` e dalla page RSC |
| SC2 | Selezionare una platform esistente attacca il formato senza inserire una nuova riga platform | VERIFIED | Branch attach in `createPrivateRows`: salta `syncPlatformIdSequence` e l'insert su `platform`; inserisce solo `importFormatVersion` con `platformId = resolvedPlatformId` — test "attach branch: skips platform insert" passa |
| SC3 | "Crea nuova platform" minta una platform pending solo quando scelta | VERIFIED | Branch create (else path): `reviewStatus: PENDING_REVIEW_STATUS`; voce "Crea una nuova platform" sempre visibile in step 1 — test "create branch regression: still inserts pending platform" passa |
| SC4 | Il redirect/onboarding flow funziona ancora dopo il salvataggio | VERIFIED | `useEffect` del wizard invariato; test "uses onboarding import copy" e "renders step 1 platform list" entrambi verdi |
| SC5 | TOCTOU guard su existingPlatformId replica la visibility rule (isActive + approved-OR-own-pending) | VERIFIED | `createPrivateRows`: SELECT con `isActive=true AND (approved OR (pending AND proposedByUserId=userId))` prima di accettare l'id — test IDOR fix e platform-no-longer-exists passano |
| SC6 | Duplicate platform name (case-insensitive) rifiutato nel branch create (server) e bloccato nel client | VERIFIED | Server: `ilike(platform.name, platformName)` in `createPrivateRows`; Client: `isDuplicateName` computed (riga 230) con `.toLowerCase()` comparison — test "create branch: rejects a platform name that duplicates an existing approved platform" passa; test UI triad (11/11) passa |

**Score:** 6/6 truths verified

---

### Plan 59-04 — isDuplicateName Gap Closure

Piano aggiunto post-verifica iniziale (completato 2026-06-30). Commit verificati:

| Commit | Description | Files |
|--------|-------------|-------|
| `71f6153` | test(59-04): RED tests for isDuplicateName gate triad | tests/import-format-wizard-ui.test.tsx |
| `3f9ca98` | feat(59-04): add isDuplicateName guard to step-1 create-new input | components/import/import-format-wizard.tsx |

**Elementi verificati nel codice** (`components/import/import-format-wizard.tsx`):

- `isDuplicateName` computed value: riga 230–234 — `selectedPlatformId === 'new' && attachablePlatforms.some((p) => p.name.toLowerCase() === platformNameInput.trim().toLowerCase())`
- `step1CanAdvance` aggiornato: riga 236–239 — include `!isDuplicateName`
- Hint JSX: riga 316–319 — `{isDuplicateName && (<p className="text-xs text-destructive" role="alert">Esiste già una piattaforma con questo nome. Selezionala dalla lista sopra.</p>)}`

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/dal/import-formats.ts` | `listAttachablePlatforms` + `AttachablePlatform` type | VERIFIED | Type esportato; funzione con injectable-db, visibilità ADR-0015, ordinamento per nome |
| `lib/validations/import.ts` | `existingPlatformId` optional field + `superRefine` guard su `platformName` | VERIFIED | `z.number().int().positive().optional()`; guard che richiede `platformName` solo nel branch create |
| `lib/services/import-format-wizard.ts` | `createPrivateRows` fork (attach vs create-platform) + TOCTOU guard + duplicate name guard | VERIFIED | Fork su `input.existingPlatformId !== undefined`; TOCTOU SELECT; ilike guard; log `import_format_wizard.attached` |
| `lib/actions/import.ts` | `existingPlatformId` propagato + `listAttachablePlatformsAction` esportata | VERIFIED | `optionalPositiveInteger(formData, 'existingPlatformId')`; `listAttachablePlatformsAction` con verifySession + DAL call |
| `components/import/import-format-wizard.tsx` | Step 1 UI, state, `attachablePlatforms` prop, hidden inputs, `isDuplicateName` guard, hint `role="alert"` | VERIFIED | Prop, stati, step 1 render, hidden inputs; `isDuplicateName` riga 230; hint con `role="alert"` riga 317 |
| `app/(app)/import/[fileId]/configure/page.tsx` | `listAttachablePlatformsAction` chiamata + `attachablePlatforms` prop passata al wizard | VERIFIED | Import, await, prop con fallback `?? []` |
| `tests/import-private-formats-dal.test.ts` | Coverage per `listAttachablePlatforms` | VERIFIED | 2 test: approved+own-pending e empty array |
| `lib/validations/__tests__/import.test.ts` | 6 nuovi test per `existingPlatformId` opzionale | VERIFIED | Describe "existingPlatformId optional field (Plan 59-02)" con 6 test cases |
| `tests/import-format-wizard-actions.test.ts` | Test attach branch, TOCTOU, IDOR, duplicate name, `listAttachablePlatformsAction` | VERIFIED | 8 nuovi test |
| `tests/import-format-wizard-ui.test.tsx` | Step 1 render, empty-list skip, onboarding regression, isDuplicateName triad | VERIFIED | 11 test passano (8 originali + 3 aggiunti da piano 59-04) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `configure/page.tsx` | `lib/actions/import.ts` | `listAttachablePlatformsAction()` await | WIRED | Import, chiamata, result propagato al wizard |
| `configure/page.tsx` | `ImportFormatWizard` | prop `attachablePlatforms={platformsResult.data ?? []}` | WIRED | Fallback `[]` su errore DAL |
| `ImportFormatWizard` | form submit | hidden inputs `existingPlatformId` (condizionale) e `platformName` (sempre) | WIRED | `validateWizardFields` legge `platformName` da FormData invariato |
| `createPrivateImportFormatAction` | `createPrivateImportFormat` service | `existingPlatformId: optionalPositiveInteger(...)` nel safeParse | WIRED | Propagato via `{ ...parsed.data, userId }` |
| `createPrivateRows` fork | `importFormatVersion` insert | `platformId: resolvedPlatformId` | WIRED | Entrambi i branch convergono su `resolvedPlatformId` prima dell'insert |
| `listAttachablePlatformsAction` | `listAttachablePlatforms` DAL | `userId` da `verifySession` (mai dal client) | WIRED | Sicurezza: userId server-only |
| `isDuplicateName` (client) | `step1CanAdvance` gate | `!isDuplicateName` nella condizione | WIRED | Hint visibile + Continua disabilitato quando duplicato rilevato |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Tutti i test della fase (61 totali) | `yarn test --run tests/import-private-formats-dal.test.ts tests/import-format-wizard-actions.test.ts tests/import-format-wizard-ui.test.tsx lib/validations/__tests__/import.test.ts` | 61 passed (4 test files), 473ms | PASS |
| Test UI del wizard (solo) | `yarn test --run tests/import-format-wizard-ui.test.tsx` | 11 passed, 439ms | PASS |
| TypeScript — file wizard | `yarn tsc --noEmit` filtrato su wizard | 0 errori nei file della fase | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PLAT-04 | 59-01, 59-02, 59-03, 59-04 | Wizard offre platform esistenti prima di crearne una nuova; attach reusa; create minta pending; client guard su nomi duplicati | SATISFIED | SC1..SC6 verificati via codice + test suite (61 test) |

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

Nessun gap. Tutti e 6 i criteri di successo sono verificati nel codice e nei test. Il piano 59-04 (isDuplicateName gap closure) ha completato la copertura UX: il client blocca l'avanzamento e mostra l'hint `role="alert"` quando l'utente tenta di creare una platform con un nome già esistente.

---

### Notes

- Il piano 59-04 era un gap-closure post-UAT: la VERIFICATION.md iniziale (2026-06-29) marcava SC6 come VERIFIED solo lato server (ilike guard). Il piano 59-04 ha aggiunto la difesa client-side per feedback immediato all'utente.
- I 61 test (vs 58 della verifica iniziale) riflettono i 3 nuovi test dell'UI triad aggiunti dal piano 59-04.
- Gli errori TypeScript pre-esistenti (cascade-options.test.ts, category-combobox.test.tsx, overview-interactions.test.tsx, suggestion-card.test.tsx) non sono stati introdotti da questa fase.

---

_Verified: 2026-06-30T11:48:00Z_
_Verifier: Claude (gsd-verifier)_
