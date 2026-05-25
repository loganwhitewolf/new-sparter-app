# S05 Research — File Import

## Summary

S05 is a high-risk integration slice, not a simple page add. It owns active requirements **IMP-01 through IMP-05** and also unblocks the deferred monetary portions of **DASH-01/DASH-02/DASH-03** because the current dashboard DAL intentionally returns `0.00` amounts until a `transaction` table exists.

Current state is Phase 4-complete but import-empty:

- `package.json` already includes `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`; it does **not** include CSV, encoding, or Excel parsers.
- `lib/db/schema.ts` currently has only Better Auth tables plus `category`, `sub_category`, and `expense`. There is no `file`, `platform`, `import_format_version`, `transaction`, `categorization_pattern`, or `expense_classification_history` table.
- `lib/db/index.ts` already exports the critical `DbOrTx` alias needed for transactional import helpers.
- `lib/dal/dashboard.ts` explicitly says Phase 5 must rebuild category breakdown with a transaction join and currently returns empty breakdown data.
- `app/(app)/spese/page.tsx` and the dashboard page establish the Server Component + DAL + leaf Client Component pattern to follow.
- Sidebar/bottom nav already link to `/import`, but no import route exists yet.

Recommendation: plan S05 as a vertical import tracer bullet with schema first, then pure parsing/detection/hash/categorization services, then R2 upload API + UI, then transactional import + dashboard amount rewiring. Do **not** start with a file input that posts bytes to Next.js; the researched architecture requires browser-direct R2 PUT via presigned URL.

## Requirements Coverage

| Requirement | S05 ownership / implication |
|---|---|
| IMP-01 | Add file upload UI, `files` table, R2 presigned PUT initiate/confirm routes, status lifecycle, and user-scoped ownership checks. |
| IMP-02 | Add `platforms` separated from versioned `import_format_versions`; seed General, Satispay, Intesa SP, Intesa SP Carta Credito, Revolut, Fineco. |
| IMP-03 | Add detector using columns/header/delimiter/date/amount-shape signals; allow user override on analyze/confirm page. |
| IMP-04 | Add preview payload/UI: row count, duplicate count, detected platform/version, confidence, candidate list, sample rows, warnings. |
| IMP-05 | Add transactional import: parse selected format, compute stable `transactionHash`, find/create aggregated `expense` by `descriptionHash`, insert transactions, run tiered categorization gated by subscription. |
| DASH-01/02/03 support | Rebuild dashboard DAL to sum `transaction.amount` strings via Decimal and fill trend/breakdown monetary fields. |

ADV-01 through ADV-04 belong primarily to S06, but S05 needs the foundational tables/service shape for system regex and history lookup so IMP-05 can be proven. Custom regex CRUD and manual-history refinement can remain S06.

## Skill and Rule Notes

Relevant installed skills from the system prompt:

- `api-design`: useful for the `/api/files/initiate` and `/api/files/confirm` JSON contracts, status codes, and error shapes.
- `security-review`: should be run before completion because this slice touches upload bearer URLs, object storage, user data isolation, and dedup hashes.
- `react-best-practices`: applies to keeping R2/upload orchestration in a small Client Component while data reads and import confirmation remain server-side.
- `tdd` and `test`: this slice has many pure functions (`parseAmount`, `normalizeDescription`, `computeTransactionHash`, `detectImportFormat`) that should be built test-first.
- `verify-before-complete`: final completion must include fresh build/test/Playwright evidence, not just implementation claims.

Next.js 16 docs checked from `node_modules/next/dist/docs`:

- Route Handlers live in `app/**/route.ts`, support `GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS`, are not cached by default for non-GET methods, and cannot coexist at the same route segment as a `page.tsx`.
- `route.ts` context `params` are promises in Next 16.
- Dedicated `'use server'` action files are the documented pattern for Server Functions imported by Client Components; authenticate/authorize inside them and return only data the UI needs.
- Server Components should own secret/DB access; Client Components are only for browser APIs, event handlers, and upload progress.

## Professional Skill Discovery

Installed skills cover Next/React/API/security/testing, but no installed skill is specific to R2 or CSV parsing. Promising external skills found but **not installed**:

- Cloudflare R2: `npx skills add jezweb/claude-skills@cloudflare-r2` — 468 installs, directly relevant to R2 bucket/CORS/presigned URL work.
- CSV parsing: `npx skills add majesticlabs-dev/majestic-marketplace@csv-wrangler` — 44 installs; relevance moderate because S05 needs bank CSV parsing and normalization.
- AWS S3 presigned URLs: search results were mostly generic AWS or Java SDK; not as relevant as the R2-specific skill. `aj-geddes/useful-ai-prompts@aws-s3-management` has 360 installs but is tangential vs R2 docs.

## Implementation Landscape

### Existing files and roles

- `lib/db/schema.ts` — current schema; add new enums/tables here. Existing table names are singular (`expense`, `category`, `subCategory`) and columns use snake_case DB names with camelCase TS properties. Follow this style.
- `lib/db/index.ts` — exports `db` and `DbOrTx`. Reuse `DbOrTx` for every helper called inside `importFile()` so writes do not escape the transaction.
- `drizzle/seed.ts` — currently seeds only categories/subcategories. Extend or split to seed platform/import format versions and system categorization patterns.
- `docs/init/seed.ts` — old source of truth for platform specs and 28 system regex patterns. It is not wired to current schema but has concrete values for General, Satispay, Intesa SP, Intesa SP Carta Credito, Revolut, Fineco.
- `lib/utils/decimal.ts` — already has `toDecimal()` and `toDbDecimal()`. Use these for all transaction amount writes/reads; source monetary values should remain strings at API/DAL boundaries.
- `lib/dal/auth.ts` — `verifySession()` returns `{ userId, subscriptionPlan, role }` and supports the staging bypass header for tests. Route Handlers and Server Actions should reuse it where possible.
- `lib/dal/dashboard.ts` — needs Phase 5 update after `transaction` exists. Current `getCategoriesBreakdown()` returns `[]`; `getOverview()` has monetary placeholders; trend only counts uncategorized/ignored from expenses.
- `app/(app)/dashboard/page.tsx` — data-backed Server Component pattern with async `searchParams`, Suspense around Client filter, and DAL reads.
- `app/(app)/spese/page.tsx` + `components/expenses/*` — reference pattern for Italian copy, shadcn components, `useActionState`, toast feedback, category selects, and bulk categorization UI.
- `tests/dashboard.spec.ts` — already has staging header helper and skipped seeded-data assertions; update/extend once transaction amounts exist.
- `playwright.config.ts` — loads env so `STAGING_KEY` test header works.

### Missing areas to create

Likely new files:

- `app/api/files/initiate/route.ts` — POST small JSON `{ name, size, type }`, create user-owned file row, generate presigned PUT URL.
- `app/api/files/confirm/route.ts` — POST `{ fileId }`, verify ownership, HEAD object in R2, mark upload metadata/confirmation while keeping status `pending` until processing.
- `app/(app)/import/page.tsx` — upload entry page using a Client upload component.
- `app/(app)/import/[fileId]/analyze/page.tsx` — Server Component wrapper that renders preview/confirm UI for a user-owned file.
- `components/import/import-uploader.tsx` — Client Component for file input, validation, initiate → XHR/PUT progress → confirm → navigate.
- `components/import/import-preview.tsx` — Client Component for candidate/manual platform+format selection and confirm action.
- `lib/services/r2.ts` — server-only S3Client wrapper, `createPresignedPutUrl`, `headObject`, `getObjectBuffer/stream` helpers. R2 config: `region: 'auto'`, endpoint `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials from env.
- `lib/services/import-format-detector.ts` — pure scoring over headers/delimiter/date/amount signals against active format versions.
- `lib/services/import-parsers.ts` or `lib/services/import.ts` — decode file, parse rows, normalize date/amount/description, dry-run analyze, transactional import.
- `lib/services/categorization.ts` — system regex/history pipeline; accept `DbOrTx` for import transaction safety.
- `lib/dal/files.ts`, `lib/dal/import-formats.ts`, `lib/dal/transactions.ts` — user-scoped DAL/helpers. Keep DB access server-only.
- `lib/validations/import.ts` — Zod schemas for initiate, confirm, analyze/import actions, platform override.
- `lib/utils/import.ts` or focused utils under `lib/utils/` — `normalizeDescription`, `computeDescriptionHash`, `computeTransactionHash`, `parseItalianAmount`, `parseBankDate` with unit tests.
- `tests/import.spec.ts` — Playwright route/upload/preview smoke tests; data-dependent imports can use fixtures and/or stay fixme until a DB fixture harness exists.
- `tests/fixtures/import/*` — tiny representative CSV fixtures for General, Intesa, Fineco, Revolut, etc. Include at least one ISO-8859-1 encoded fixture if encoding library is added.

## Data Model Recommendation

Add schema in small batches with generated migrations. Do not use `drizzle-kit push`.

Minimum S05 tables/enums:

- `fileStatusEnum`: `pending`, `processing`, `done`, `error` (optionally `uploaded`, but the research says keep `pending` after confirm until import starts; use `uploadedAt` instead of new status unless UX requires it).
- `amountTypeEnum`: `single`, `separate`.
- `amountSignEnum`: `positive`, `negative`, `any`.
- `categorizationMethodEnum`: `regex`, `history`, `manual`, `ai` if adding metadata to `expense`.
- `file`: `id`, `userId`, `name/originalName`, `status`, `platformId`, `importFormatVersionId`, `storageKey`, `contentType`, `sizeBytes`, `rowCount`, `duplicateCount`, `errorMessage`, `uploadedAt`, timestamps. Index `userId,status`; unique enough to prevent accidental duplicate `storageKey`.
- `platform`: `id`, `name`, `slug`, `country`, `isActive`, timestamps. Unique `slug`.
- `importFormatVersion`: `id`, `platformId`, `version`, `delimiter`, `descriptionColumn`, `amountType`, `amountColumn`, `positiveAmountColumn`, `negativeAmountColumn`, `timestampColumn`, `dateFormat`, `dateReplace`, `decimalReplace`, `multiplyBy`, `isActive`, `isDefault`, optional `detectionRules` JSON. Unique `(platformId, version)`.
- `transaction`: `id`, `userId`, `amount` as Drizzle `decimal/numeric(10,2)` returning string, `timestamp`, `description`, `normalizedDescription`, `transactionHash`, `expenseId`, `fileId`, `isImportant`, timestamps. Unique should include `userId` plus `transactionHash` to avoid cross-user collisions; index user/date/file/expense.
- `categorizationPattern`: `id`, nullable `userId`, `pattern`, `subCategoryId`, `amountSign`, `confidence`, `priority`, `description`, `isActive`, timestamps. Query system rows (`userId IS NULL`) plus user rows, ordered user-first then priority.
- `expenseClassificationHistory`: `id` or composite, `userId`, `expenseKey`, `subCategoryId`, `weight`, timestamps. Unique `(userId, expenseKey, subCategoryId)`.

Existing `expense` is missing handoff fields `confidenceScore`, `categorizationMethod`, `sourceFileId`. Add them if the import pipeline needs auditability; otherwise at minimum ensure `descriptionHash` is unique per user. The current schema only indexes `descriptionHash` and does **not** enforce unique `(userId, descriptionHash)`, but IMP-05 requires this aggregation. Add the unique constraint carefully and ensure existing nullable/manual rows do not violate it.

## R2 / Upload Findings

Cloudflare R2 official docs confirm:

- AWS SDK v3 works with `S3Client` configured as `region: 'auto'` and endpoint `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`.
- Presigned URLs can cover `GET`, `HEAD`, `PUT`, and `DELETE`; `POST` multipart form uploads are not supported.
- `getSignedUrl(client, new PutObjectCommand({ Bucket, Key, ContentType }), { expiresIn })` is the right SDK shape.
- If `ContentType` is signed, the browser PUT must include the exact matching `Content-Type` header or R2 returns signature errors.
- Browser presigned upload needs R2 bucket CORS configured, e.g. PUT method, allowed production/local origins, `Content-Type` allowed, and `ETag` exposed.
- Treat presigned URLs as bearer tokens; use short expiries (15 minutes is a good default) and retry initiate if expired.

Concrete service contract for `lib/services/r2.ts`:

```ts
const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})
```

Required env keys: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`. If an executor hits missing env while testing, use `secure_env_collect`; do not ask the user to edit `.env` manually.

## Parsing / Detection Findings

Use `csv-parse` (Node CSV) rather than hand-rolled CSV splitting. Context7 docs confirm useful options:

- `columns: true` to use first row headers.
- `skip_empty_lines: true`, `trim: true`, `bom: true`.
- `delimiter` configurable per format.
- sync API is fine for tiny preview fixtures, but streaming/async iterator is available for large files.

Additional dependencies likely needed:

- `csv-parse` for CSV.
- `chardet` or `jschardet` plus `iconv-lite` for Italian bank encodings (ISO-8859-1 fallback). This is specifically called out in project pitfalls.
- `xlsx` or an alternative for Excel. Be cautious: project pitfalls warn about memory/timeouts and historical `xlsx` advisories. For S05, either cap Excel size strictly or implement CSV first with Excel fixture stubs if planner chooses to de-risk incrementally. Requirement text says CSV or Excel, so final S05 should not claim complete without at least a basic Excel path or an explicit scoped deferral.

Detection should be pure and fixture-tested before R2/UI:

1. Read bytes from fixture/R2.
2. Detect/decode to UTF-8, strip BOM.
3. Infer delimiter if format not fixed or for candidate scoring.
4. Parse header row and sample rows.
5. Score active `importFormatVersion` candidates by required columns, delimiter match, amount shape (`single` vs `separate`), date parseability, decimal comma/period, and currency/amount sanity.
6. Return best candidate plus candidates list and warnings.

Platform seeds from `docs/init/seed.ts`:

| Platform / format | Key mapping |
|---|---|
| General | delimiter `,`; description `description`; amount single `amount`; timestamp `timestamp`; dateFormat `null`; multiplyBy `1`. |
| Satispay | description `Nome`; amount `Importo`; timestamp `Data`; dateFormat `DD MMM YYYY. HH:mm:ss`; dateReplace true. |
| Intesa SP | description `Operazione`; amount `Importo`; timestamp `Data`; dateFormat `DD-MM-YYYY`; decimalReplace true. |
| Intesa SP Carta Credito | description `Descrizione`; amount `Addebiti`; timestamp `Data operazione`; dateFormat `DD/MM/YYYY`; decimalReplace true; multiplyBy `-1`. |
| Revolut | description `Description`; amount `Amount`; timestamp `Completed Date`; dateFormat `null`. |
| Fineco | description `Descrizione_Completa`; amount type `separate`; positive `Entrate`; negative `Uscite`; timestamp `Data`; dateFormat `DD/MM/YYYY`. |

## Transaction and Categorization Findings

`computeTransactionHash` is a core seam and must be locked before data is stored. Project pitfalls recommend normalizing inputs first:

- amount → `Decimal(...).toFixed(2)` via `toDbDecimal()`.
- timestamp → ISO date string, e.g. `YYYY-MM-DD` or full ISO if time matters.
- description → trim and collapse whitespace.
- Consider including `platformId` in the hash to avoid same-looking cross-platform transactions colliding. At minimum include `userId` in the DB unique constraint.

`descriptionHash` should be based on normalized description only and scoped by user. Import should find or create one `expense` per `(userId, descriptionHash)` and link many transactions to it. This is consistent with `docs/init/BUSINESS_LOGIC_HANDOFF.md` and Phase 3 UI.

Categorization pipeline for S05:

- `free`: return uncategorized (`status='1'`, no subcategory).
- `basic` and `pro`: run regex patterns first, then history. Pro AI remains v2; fallback remains status `1`.
- Regex should apply by normalized description and `amountSign`. Negative/positive signs matter because `bonifico` maps to both in/out categories depending on sign.
- Pattern query should include global system patterns (`userId IS NULL`) and user patterns for future S06; S05 can seed only system patterns.
- ADV-03 food delivery patterns (Deliveroo, JustEat, Glovo, Wolt → `take-away`) are listed under S06 requirements, but milestone research calls them a critical v1 gap. Planner should decide whether to seed them in S05 system patterns or leave to S06; if left to S06, do not claim ADV-03.

## Natural Seams / Suggested Task Boundaries

1. **Schema + seeds + fixtures first**
   - Modify `lib/db/schema.ts`, `drizzle/seed.ts`, migrations.
   - Add platform/import format/system pattern seeds.
   - Add tiny CSV fixtures and pure unit test scaffolds.
   - Verification: `npm run db:generate`, `npm run build`, schema grep/tests.

2. **Pure import utilities and detector**
   - Add parse/normalize/hash/date/amount functions and `detectImportFormat()`.
   - No R2, no UI yet.
   - Verification: Vitest fixture tests for General/Intesa/Fineco/Revolut, duplicate hash stability, decimal comma handling, description normalization.

3. **R2 service + upload API contract**
   - Add `lib/services/r2.ts`, `lib/dal/files.ts`, `app/api/files/initiate/route.ts`, `app/api/files/confirm/route.ts`, `lib/validations/import.ts`.
   - Mock or isolate R2 helpers for tests if real env is unavailable.
   - Verification: build, route handler validation/unit tests; with env available, HEAD/PUT smoke against R2.

4. **Upload UI + analyze preview UI**
   - Add `/import` page and upload Client Component; add `/import/[fileId]/analyze` preview.
   - Keep file bytes browser → R2 only. Use `XMLHttpRequest` if progress is required; `fetch` gives no upload progress.
   - shadcn `progress` does not exist in the repo; add it or implement a simple accessible progress bar.
   - Verification: Playwright smoke for page render, file validation error, and route navigation; real upload test can be skipped/fixme without R2 env.

5. **Transactional import service + actions**
   - Add `analyzeFileAction(fileId)` and `importFileAction(fileId, formatVersionId)` as thin server actions.
   - `importFile()` must wrap all file status, expense, transaction, and categorization writes in `db.transaction(async (tx) => ...)` and all helpers must accept `DbOrTx`.
   - Verification: integration/unit test that throws after N rows and asserts rollback; duplicate import test; build.

6. **Dashboard DAL rewiring**
   - Update `getOverview`, `getCategoriesBreakdown`, and `getAggregatedTransactionsData` to use `transaction.amount` and dates.
   - Keep monetary returns as strings and compute percentages with Decimal helpers.
   - Verification: dashboard unit tests or seeded DB tests; `tests/dashboard.spec.ts` still passes non-seeded smoke.

## Verification Strategy

Minimum commands/checks for the planner to require across tasks:

- `npm run build` after schema/service/UI integration.
- `npx vitest run` for pure utility/parser/detector/hash/categorization tests.
- `npx playwright test tests/import.spec.ts --reporter=list` for import route/UI smoke.
- `npx playwright test tests/dashboard.spec.ts --reporter=list` after dashboard DAL rewiring.
- `npx playwright test --reporter=list` at slice close.
- If migrations change: `npm run db:generate` and inspect generated SQL for expected enums/tables/indexes; do not use `drizzle-kit push`.

Important test cases:

- CSV delimiter/header detection returns correct platform/version for each fixture.
- Italian decimal comma `-12,50` normalizes to `-12.50` and remains string for DB writes.
- Fineco separate Entrate/Uscite columns produce positive/negative amounts correctly.
- Intesa credit card `multiplyBy: -1` flips positive charges to outflows.
- `computeTransactionHash()` is stable across whitespace and equivalent amount/date formatting.
- Duplicate transaction is counted in preview and skipped on import.
- Failed import inside transaction leaves no partial file/expense/transaction rows and marks/returns an error intentionally.
- Free subscription does not auto-categorize; basic/pro apply regex/history when available.
- `verifySession()`/user scoping prevents analyzing/importing another user’s file.
- Dashboard totals/breakdown/trend exclude explicit `ignore` category and include uncategorized counts.

## Risks and Pitfalls

- **Critical atomicity risk:** any helper that imports module-level `db` inside `importFile()` can escape the transaction. Enforce `DbOrTx` signatures in import helpers.
- **Upload anti-pattern:** do not post `FormData` file bytes to a Server Action or Next Route Handler. It buffers file bytes and violates the chosen R2 architecture.
- **R2 CORS:** browser PUT will fail even with a valid presigned URL if bucket CORS is missing/wrong. Tests from localhost are not enough for production domain readiness.
- **Signed Content-Type:** if the URL signs `ContentType`, the browser PUT must send the exact same value.
- **Encoding:** Italian bank CSVs can be ISO-8859-1. Without detection/fallback, accented descriptions break regex and preview looks corrupted.
- **Excel memory:** `xlsx` can be memory-heavy. Cap file sizes and test realistic exports before claiming Excel support.
- **Hash stability:** changing hash normalization after imports exist causes dedup bugs. Unit-test heavily before shipping.
- **Current `expense` table semantics:** manual expenses have no amounts; imported transactions will make expenses aggregate multiple raw rows. UI copy may need to explain that `Spese` rows are semantic groups, not every transaction.
- **Dashboard coupling:** S04 intentionally left monetary values zero; S05 must include dashboard rewiring or downstream dashboard requirements remain partially unfulfilled.
- **Client/server boundary:** import Client Components must import only types or server actions, never `lib/db`, DAL, `auth.ts`, or R2 services. `server-only` will catch some violations.

## Sources Consulted

- Project files: `package.json`, `lib/db/schema.ts`, `lib/db/index.ts`, `lib/dal/auth.ts`, `lib/dal/dashboard.ts`, `lib/dal/expenses.ts`, `lib/dal/categories.ts`, `app/(app)/spese/page.tsx`, `components/expenses/*`, `tests/dashboard.spec.ts`, `tests/expenses.spec.ts`.
- Legacy/source docs: `.planning/REQUIREMENTS.md`, `.planning/research/FEATURES.md`, `.planning/research/PITFALLS.md`, `docs/init/BUSINESS_LOGIC_HANDOFF.md`, `docs/init/seed.ts`.
- Next.js 16 local docs: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`, `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md`, `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`.
- Context7: `/aws/aws-sdk-js-v3` for `getSignedUrl`, `PutObjectCommand`, custom S3 endpoint, `forcePathStyle`; `/adaltas/node-csv` for `csv-parse` options.
- Web: Cloudflare R2 docs, query `Cloudflare R2 S3 API S3Client region auto endpoint presigned URL CORS browser upload PutObjectCommand HeadObject 2026 docs`; specifically `https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/index.md` and R2 presigned URLs page.
