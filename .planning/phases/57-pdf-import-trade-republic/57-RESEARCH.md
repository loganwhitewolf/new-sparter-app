# Phase 57: pdf-import-trade-republic — Research

**Researched:** 2026-06-25
**Domain:** PDF parsing (unpdf / PDF.js), import pipeline integration, presigned PUT upload
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Per-bank template, not generic — each bank gets a deterministic template identified by document markers.
- **D-02:** Normalize to `ParsedImportFile` — PDF parser produces `{headers, rows}` with synthetic headers; downstream pipeline unchanged.
- **D-03:** Sign via X-coordinate position + balance chain validation — `unpdf` token X coordinates; mismatch → explicit error.
- **D-04:** `unpdf` is the PDF library (no `pdf-parse`).
- **D-05:** Upload via presigned PUT — 5 MB cap + defensive page ceiling; both fail with explicit error before R2 upload.
- **D-06:** `descriptionStripPattern: 'quantity:'` for Trade Republic.
- **D-07:** TR date and amount format already supported (`parseBankDate`, `parseItalianAmount`, `amountType: 'separate'`).
- **D-08:** PDF platform is a standard `import_format_version` with synthetic headers — no `parserKind` field yet.

### Claude's Discretion

- Exact synthetic header names for TR columns
- Whether to add `parserKind: 'pdf'` to `import_format_version` now or defer
- Where to place the TR PDF parser (new file under `lib/import/parsers/` or inline in import flow)
- Whether the page ceiling is configurable or hardcoded
- Exact error message wording for size/page violations and balance chain mismatches

### Deferred Ideas (OUT OF SCOPE)

- Tier-1 categorization patterns for TR descriptions
- PDF templates for additional banks
- Retroactive re-hash of already-imported history when `descriptionStripPattern` changes
- `parserKind: 'pdf'` field on `import_format_version`
- Generic multi-bank PDF parser
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PDF-01 | User can upload a `.pdf` (application/pdf) via presigned PUT, 5 MB cap + page ceiling, explicit error | Upload path analysis confirms where to add MIME + size/page guard |
| PDF-02 | System recognizes TR statement by markers, extracts only "TRANSAZIONI SUL CONTO" section | `unpdf` `extractTextItems` returns positioned tokens — markers found by string matching on `str` field |
| PDF-03 | Sign determined positionally (X coordinates via `unpdf`), cross-checked vs balance chain | `StructuredTextItem.x` confirmed as the positioning source; Decimal.js required for chain math |
| PDF-04 | PDF rows pass unchanged through detector → normalizeTransactionRow → dedup → preview | `ParsedImportFile` shape confirmed; `scoreCandidate` is delimiter-agnostic when `parsed.delimiter` is null |
| PDF-05 | TR `descriptionStripPattern: 'quantity:'` so recurring rows aggregate into a single Expense | `normalizeTransactionRow` applies `new RegExp(platform.descriptionStripPattern, 'i')` — already wired |
</phase_requirements>

---

## Summary

Phase 57 adds PDF import support for Trade Republic bank statements. The design is well-defined in ADR 0014 and the CONTEXT.md: a per-bank template that converts a PDF into a `ParsedImportFile` object and feeds the existing pipeline unchanged.

The key library is `unpdf` (v1.6.2, 1.3M weekly downloads, MIT, unjs org). Its `extractTextItems` API returns positioned tokens with `x`, `y`, `width`, `height`, `fontSize` per item — exactly what is needed for positional sign determination. The library bundles a serverless-optimized PDF.js build compatible with Vercel Edge / Node.js runtimes. It is not yet in the project's `package.json` and must be installed.

The existing import pipeline requires zero changes for PDF rows because `scoreCandidate` only penalizes delimiter mismatches when `parsed.delimiter` is non-null — a PDF-generated `ParsedImportFile` sets `delimiter: null`, so the 5% delimiter weight scores full. The `normalizeTransactionRow` path for `amountType: 'separate'` (positive/negative columns) is already production-tested by Fineco's CSV format, making it a solid reference for the TR mapping.

**Primary recommendation:** Add `lib/services/trade-republic-pdf-parser.ts` that produces a `ParsedImportFile`, extend `lib/services/import-parsers.ts` to dispatch to it for `.pdf` files, and add `application/pdf` to `IMPORT_CONTENT_TYPES` in `lib/validations/import.ts`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PDF upload (client-side file selection + presigned PUT) | Browser / Client | — | Matches existing CSV/XLSX upload path; bytes never proxy through server |
| Upload initiation, MIME validation, size cap | API / Backend | — | `app/api/files/initiate/route.ts` already owns this; extend for PDF |
| Page ceiling validation | API / Backend | — | Must fail early, before R2 write; belongs alongside size cap in the initiate route |
| PDF token extraction (`unpdf`) | API / Backend | — | Serverless-compatible; runs in `lib/services/trade-republic-pdf-parser.ts` |
| Section detection (document markers) | API / Backend | — | Pure logic inside TR PDF parser service |
| Positional sign determination (X coordinates) | API / Backend | — | Pure logic inside TR PDF parser service |
| Balance chain validation (Decimal.js) | API / Backend | — | Pure logic inside TR PDF parser service |
| `ParsedImportFile` output, detector, normalize, dedup | API / Backend | — | Existing pipeline — no changes needed |
| Seed (platform + import_format_version for TR) | Database / Storage | — | `scripts/seed-data.ts` additive row |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `unpdf` | 1.6.2 | PDF token extraction with X/Y coordinates | Locked in ADR 0014; serverless-compatible PDF.js wrapper; `extractTextItems` returns `StructuredTextItem[]` with x/y positions |
| `decimal.js` | 10.6.0 (already installed) | Balance chain arithmetic | Project hard rule — all monetary arithmetic |

[VERIFIED: npm registry] — `unpdf` v1.6.2 confirmed via `npm view unpdf version`.
[VERIFIED: npm registry] — `decimal.js` already in `package.json` dependencies.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `unpdf` | `pdf-parse` | Rejected in ADR 0014 — flat text only, no coordinates |
| `unpdf` | `pdfjs-dist` directly | Works but requires `Promise.withResolvers` (Node >= 22); `unpdf` bundles a serverless build that works on older runtimes |

**Installation:**
```bash
yarn add unpdf
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `unpdf` | npm | ~3 yrs (2023-08-11) | 1.3M/wk | github.com/unjs/unpdf | OK | Approved |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  │ (1) user selects .pdf file
  │
  ▼
app/api/files/initiate/route.ts
  │ validates: MIME = application/pdf, size ≤ 5 MB, pages ≤ ceiling
  │ ← NEW: add 'application/pdf' to IMPORT_CONTENT_TYPES; add page ceiling check
  │ creates file record (status: pending_upload), returns presigned PUT URL
  │
  ▼
Cloudflare R2  ← browser PUTs directly, never through server
  │
  ▼
app/api/files/confirm/route.ts
  │ (unchanged)
  │
  ▼
lib/services/import-parsers.ts  parseImportFile(bytes, {fileName})
  │ ← NEW: branch on lowerName.endsWith('.pdf') → parsePdf(bytes, options)
  │
  ▼
lib/services/trade-republic-pdf-parser.ts  parseTradRepublicPdf(bytes, options)
  │  1. getDocumentProxy(bytes) → pdf
  │  2. getMeta(pdf) → check page count ≤ ceiling
  │  3. extractTextItems(pdf) → StructuredTextItem[][]
  │  4. Locate markers: "TRADE REPUBLIC" + "TRANSAZIONI SUL CONTO"
  │  5. Extract rows: identify columns by X-coordinate bands (data / descrizione /
  │     importo_entrata / importo_uscita / saldo)
  │  6. Balance chain validation with Decimal.js
  │  7. Return ParsedImportFile {headers: SYNTHETIC_HEADERS, rows, ...}
  │
  ▼
lib/services/import-format-detector.ts  detectImportFormat({parsed, formats})
  │  scoreCandidate matches synthetic headers against seeded importFormatVersion
  │  (delimiter: null → delimiterScore = 1.0, no penalty)
  │
  ▼
lib/utils/import.ts  normalizeTransactionRow(row, platformConfig)
  │  amountType: 'separate' → positiveAmountColumn / negativeAmountColumn
  │  descriptionStripPattern: 'quantity:' applied via RegExp
  │
  ▼
lib/services/import.ts  importFile()  (inside db.transaction)
  │  dedup, expense upsert, categorization pipeline
  │
  ▼
PostgreSQL (expense + transaction tables)
```

### Recommended Project Structure

```
lib/services/
├── import-parsers.ts          # existing — add .pdf dispatch branch
├── trade-republic-pdf-parser.ts  # NEW — TR-specific unpdf extraction
└── r2.ts                      # unchanged

scripts/
├── seed-data.ts               # add TR platform row + importFormatVersion row

components/import/
├── import-uploader.tsx        # add '.pdf' to ACCEPTED_EXTENSIONS + 'application/pdf' to types

lib/validations/
├── import.ts                  # add 'application/pdf' to IMPORT_CONTENT_TYPES; add '.pdf' to SUPPORTED_EXTENSIONS

tests/
├── trade-republic-pdf-parser.test.ts  # NEW
└── fixtures/import/
    └── trade-republic-sample.pdf      # NEW (or synthetic fixture)
```

### Pattern 1: `unpdf` Token Extraction

**What:** Load PDF bytes into a proxy, extract positioned tokens per page.
**When to use:** Any server-side PDF parsing with positional awareness.

```typescript
// Source: https://context7.com/unjs/unpdf/llms.txt
import { getDocumentProxy, extractTextItems, getMeta } from 'unpdf'
import type { StructuredTextItem } from 'unpdf'

// bytes: Buffer from R2 read
const pdf = await getDocumentProxy(new Uint8Array(bytes))
const { info } = await getMeta(pdf)         // totalPages available via pdf.numPages
const { totalPages, items } = await extractTextItems(pdf)
// items[pageIndex]: StructuredTextItem[] — one array per page
// Each item: { str, x, y, width, height, fontSize, fontFamily, dir, hasEOL }
```

[VERIFIED: context7 — /unjs/unpdf] via `extractTextItems` API documentation.

### Pattern 2: Positional Column Assignment

**What:** Determine credit/debit column by comparing token X coordinate to column boundary thresholds calibrated from the TR PDF layout.
**When to use:** Any PDF with separate credit/debit columns where empty cells disappear in text extraction.

```typescript
// Source: codebase analysis + ADR 0014 design
// Column boundaries derived from TR PDF layout (to be calibrated with real fixture)
const CREDIT_X_MIN = 340  // approximate — adjust from real PDF
const CREDIT_X_MAX = 420
const DEBIT_X_MIN  = 420
const DEBIT_X_MAX  = 510

function classifyAmountToken(item: StructuredTextItem): 'credit' | 'debit' | 'balance' | 'unknown' {
  if (item.x >= CREDIT_X_MIN && item.x < CREDIT_X_MAX) return 'credit'
  if (item.x >= DEBIT_X_MIN  && item.x < DEBIT_X_MAX)  return 'debit'
  // ... balance column
  return 'unknown'
}
```

### Pattern 3: Balance Chain Validation

**What:** After extracting all rows, verify that each row satisfies `prevBalance + signedAmount ≈ currBalance`.
**When to use:** Any PDF import where the source document includes a running balance column.

```typescript
// Source: ADR 0014 design; Decimal.js required by project rules
import Decimal from 'decimal.js'

function validateBalanceChain(rows: Array<{amount: string; balance: string}>): void {
  for (let i = 1; i < rows.length; i++) {
    const prev = new Decimal(rows[i - 1]!.balance)
    const amount = new Decimal(rows[i]!.amount)
    const curr = new Decimal(rows[i]!.balance)
    if (!prev.plus(amount).eq(curr)) {
      throw new Error(
        `Balance chain mismatch at row ${i + 1}: ` +
        `${prev.toFixed(2)} + ${amount.toFixed(2)} ≠ ${curr.toFixed(2)}`
      )
    }
  }
}
```

### Pattern 4: `ParsedImportFile` Synthetic Output

**What:** The TR PDF parser must return the same shape as `parseImportFile` so the detector can consume it unchanged.
**When to use:** Any PDF parser integration point.

```typescript
// Source: lib/services/import-parsers.ts (codebase read)
// Synthetic header names (Claude's discretion — chosen to be unambiguous)
export const TR_SYNTHETIC_HEADERS = ['data', 'descrizione', 'importo_entrata', 'importo_uscita'] as const

// Return shape must match ParsedImportFile:
const result: ParsedImportFile = {
  fileName: options.fileName,
  byteLength: bytes.byteLength,
  encoding: null,       // PDFs have no encoding in the CSV sense
  delimiter: null,      // no CSV delimiter — scoreCandidate handles null cleanly
  headers: [...TR_SYNTHETIC_HEADERS],
  rows,                 // ParsedImportRow[] — Record<string, string>
  rowCount: rows.length,
  sampleRows: rows.slice(0, options.sampleSize ?? 25),
  warnings,
  errors,
}
```

### Anti-Patterns to Avoid

- **Hardcoding absolute X values without a fixture:** X coordinates vary between PDF generators. Derive column boundaries from the TR fixture first, then hardcode the calibrated thresholds with a comment referencing the fixture.
- **Using `pdf-parse` or text-only extraction:** Produces flat text; loses column structure; empty cells disappear; both credit and debit appear as positive numbers. Locked out in ADR 0014.
- **Bypassing `parseImportFile` dispatch:** If the PDF parser is called directly from `analyzeFile`/`importFile` in `lib/services/import.ts`, the preview, analysis, and dedup paths would diverge. The correct integration is inside `parseImportFile` as a branch on `.pdf` extension.
- **Floating-point arithmetic for balance chain:** Native `+` on monetary strings silently accumulates rounding errors. Always use `Decimal.js`.
- **Accepting `text/pdf` as MIME type:** The correct MIME type is `application/pdf`. Some browsers emit `application/octet-stream` for PDF — the validation should accept both, or at least be defensive about empty `file.type`.

---

## Research Questions — Answers

### Q1: `unpdf` API for token-level coordinate extraction

`unpdf` v1.6.2 provides `extractTextItems(pdf)` which returns `{ totalPages, items: StructuredTextItem[][] }`. Each `StructuredTextItem` has:

```typescript
{
  str: string       // the text content of the token
  x: number        // left edge X coordinate (points)
  y: number        // bottom edge Y coordinate (points, PDF coordinate system — Y increases upward)
  width: number    // token width
  height: number   // token height (= fontSize for most tokens)
  fontSize: number
  fontFamily: string
  dir: string      // 'ltr' | 'rtl'
  hasEOL: boolean  // true if this token ends a line
}
```

Usage pattern for a `Buffer` received from R2:

```typescript
import { getDocumentProxy, extractTextItems, getMeta } from 'unpdf'

const pdf = await getDocumentProxy(new Uint8Array(bytes))
// getMeta does NOT return totalPages — use pdf.numPages (PDFDocumentProxy)
const { totalPages, items } = await extractTextItems(pdf)
// items is StructuredTextItem[][] — index 0 = first page
```

**Import path:** `import { getDocumentProxy, extractTextItems, getMeta } from 'unpdf'`
**Type import:** `import type { StructuredTextItem } from 'unpdf'`

No `definePDFJSModule` override is needed — the bundled serverless build is the correct choice for Vercel/Node.js environments. The `pdfjs-dist` override requires Node >= 22 (`Promise.withResolvers`) and should not be used here.

[VERIFIED: context7 — /unjs/unpdf]

### Q2: PDF parser integration point

**Decision: extend `lib/services/import-parsers.ts`, not `lib/services/import.ts`.**

`parseImportFile` in `import-parsers.ts` is already the single dispatch point for all file types (it branches on `.xlsx`/`.xls` vs CSV). Adding a `.pdf` branch here is the minimal, correct change:

```typescript
// In parseImportFile(), after the xlsx branch:
if (lowerName.endsWith('.pdf')) {
  return parseTradRepublicPdf(bytes, options)
}
```

`parseTradRepublicPdf` lives in `lib/services/trade-republic-pdf-parser.ts` and returns `ParsedImportFile`.

`analyzeFile` and `importFile` in `lib/services/import.ts` call `parseImportFile(bytes, {fileName})` — they receive a `Buffer` from `readR2Bytes` (which reads from R2 via `readObjectBody`). The buffer path is identical for all file types. No changes are needed in `import.ts`.

The alternative of hooking into `import.ts` directly would duplicate the `ParsedImportFile` path and break the preview/analysis consistency. It was explicitly rejected in ADR 0014 ("bypasses detector: duplicates the pipeline").

[VERIFIED: codebase — lib/services/import-parsers.ts, lib/services/import.ts]

### Q3: Synthetic headers and detector behavior

**`headerSignature` computation** (from `scripts/seed.ts`):
```typescript
function headerSignatureFor(fv) {
  return [fv.timestampColumn, fv.descriptionColumn, fv.amountColumn,
          fv.positiveAmountColumn, fv.negativeAmountColumn]
    .filter(Boolean)
    .join(fv.delimiter)
}
```

For TR (amountType: 'separate'), the signature would be:
```
data,descrizione,importo_entrata,importo_uscita
```
(using delimiter `,` as the join character — the delimiter field on `importFormatVersion` is still `NOT NULL` so a value like `","` must be provided even for PDF formats).

**How `scoreCandidate` matches headers:**
1. `headerScore` (45% weight): fraction of required columns found in `parsed.headers` (case-insensitive, trimmed lookup)
2. `signatureScore` (5% weight): `parsed.headers.join(format.platform.delimiter) === format.headerSignature`
3. `delimiterScore` (5% weight): `!parsed.delimiter || parsed.delimiter === format.platform.delimiter` — for PDF files `parsed.delimiter = null`, so this evaluates to `1.0` (full score, no penalty)

For TR PDF, `parsed.headers` will be exactly `['data', 'descrizione', 'importo_entrata', 'importo_uscita']` — synthetic headers produced by the extractor. The detector will match them against the seeded `importFormatVersion` row. `headerScore = 1.0`, `signatureScore = 1.0` (headers.join(',') = headerSignature), `delimiterScore = 1.0`. Expected confidence ≥ 0.9.

**`headerSignature` field:** It is a string computed at seed time as `requiredColumns.join(delimiter)`. It is used in `signatureScore` only (5% weight). Its primary purpose is to accelerate detection for exact-match cases. The synthetic headers for TR must be seeded consistently.

[VERIFIED: codebase — lib/services/import-format-detector.ts, scripts/seed.ts]

### Q4: R2 upload flow — where caps are enforced

**Current size cap location:** `lib/validations/import.ts`, `InitiateUploadSchema`:
```typescript
export const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024

size: z.number().max(MAX_IMPORT_FILE_SIZE_BYTES, { error: 'File exceeds the maximum import size.' })
```

This Zod schema is applied in `app/api/files/initiate/route.ts` before the R2 write. The client also enforces it in `components/import/import-uploader.tsx` (`validateFile`).

**Page ceiling:** Not yet implemented. It must be enforced **before** the R2 upload. The correct approach:
- The browser reads `file.arrayBuffer()` (already done for SHA-256 hashing in `import-uploader.tsx`)
- Before calling the initiate API, use `unpdf` client-side (if tree-shakeable) **or** add a server-side page check in the initiate route after the presigned URL is created but reported to the client with an error. However, checking page count server-side after upload would mean accepting the R2 write. The simplest safe approach: check page count **after** R2 upload in the confirm route (the file is already there), fail the confirm step, and clean up. Alternatively, validate in `parseImportFile` itself and return a `ParsedImportFile` with errors.

**Recommended approach for page ceiling:** Enforce in `parseImportFile` → `parseTradRepublicPdf` using `pdf.numPages` after `getDocumentProxy`. Return `emptyResult` with an error if exceeded. This is consistent with how `parseImportFile` handles size overflows today (returns `emptyResult` with an error array). The analysis step will then propagate the error to the UI.

**`createPresignedPutUrl` signature:**
```typescript
export async function createPresignedPutUrl(input: {
  objectKey: string
  contentType: string
  contentLength: number
}): Promise<{ url: string; expiresIn: number } | never>
```

[VERIFIED: codebase — app/api/files/initiate/route.ts, lib/validations/import.ts, lib/services/r2.ts]

### Q5: Balance chain validation with Decimal.js

Standard approach for a running-balance verification:

```typescript
import Decimal from 'decimal.js'

// rows: Array<{ signedAmount: string; runningBalance: string }>
// Both values extracted from PDF and passed through parseItalianAmount first
function validateBalanceChain(rows: { signedAmount: string; runningBalance: string }[]): void {
  for (let i = 1; i < rows.length; i++) {
    const prev = new Decimal(rows[i - 1]!.runningBalance)
    const amount = new Decimal(rows[i]!.signedAmount)
    const curr = new Decimal(rows[i]!.runningBalance)
    // Use Decimal comparison — no floating-point errors
    if (!prev.plus(amount).eq(curr)) {
      throw new Error(
        `Balance chain mismatch at row ${i + 1}: ` +
        `expected ${prev.toFixed(2)} + ${amount.toFixed(2)} = ${curr.toFixed(2)}`
      )
    }
  }
}
```

**Decimal.js requirement:** Project hard rule — never use native `+`/`-` on monetary amounts. TR PDF amounts are in Italian format (`1.006,85`) — pass through `parseItalianAmount` before constructing `Decimal` instances.

**Tolerance:** Trade Republic PDFs may round the running balance to 2 decimal places. A tolerance of `0.005` could be added if real-world fixtures show rounding artifacts, but start with exact equality (`.eq()`) first.

[VERIFIED: codebase — lib/utils/import.ts (parseItalianAmount, toDecimal)]

### Q6: `amountType: 'separate'` in `normalizeTransactionRow`

From `lib/utils/import.ts`:

```typescript
} else {
  const positive = parseItalianAmount(row[platform.positiveAmountColumn ?? ''])
  const negative = parseItalianAmount(row[platform.negativeAmountColumn ?? ''])
  if (positive && negative && positive !== '0.00' && negative !== '0.00') {
    warnings.push(`Row ${context.rowIndex}: both positive and negative amount columns are populated; positive column wins`)
  }
  if (positive && positive !== '0.00') {
    amount = positive
  } else if (negative) {
    amount = toDbDecimal(new Decimal(negative).abs().mul(-1))
  }
}
```

The `separate` path:
- `positiveAmountColumn` maps to `importo_entrata` — credit amounts → stored as positive
- `negativeAmountColumn` maps to `importo_uscita` — debit amounts → stored as **negative** (`abs().mul(-1)`)
- If both are populated, positive wins with a warning
- If a cell is empty (`''`), `parseItalianAmount('')` returns `null` → that column is ignored

This maps exactly to the TR PDF structure: each row has either an entry in the `importo_entrata` column or in the `importo_uscita` column, never both (confirmed by ADR 0014 design). The positional extraction leaves an empty string for the absent column.

[VERIFIED: codebase — lib/utils/import.ts normalizeTransactionRow]

### Q7: `descriptionStripPattern` application

From `lib/utils/import.ts`:

```typescript
const description = platform.descriptionStripPattern
  ? rawDescription.replace(new RegExp(platform.descriptionStripPattern, 'i'), '').trim()
  : rawDescription
```

The pattern is applied with the `i` (case-insensitive) flag. The `normalizedDescription` (used for `descriptionHash`) is derived from the stripped `description`, so two descriptions that differ only in the `quantity: <num>` suffix will produce the same `descriptionHash` and will be grouped into the same `Expense`.

**For TR:** `descriptionStripPattern: 'quantity:'` will match and remove from `"ETF savings plan quantity: 3"` the substring `quantity:` and everything the regex captures — but note the pattern `quantity:` alone only matches those literal characters, not the trailing number. A more robust pattern would be `quantity:\\s*\\d+(\\.\\d+)?` but the ADR explicitly says "minimal strip pattern". The current pattern strips the prefix trigger word, leaving ` 3` as a trailing artifact. However, `normalizeDescription` also collapses whitespace and lowercases, so minor trailing fragments are unlikely to cause false splits.

**Recommendation:** Seed `descriptionStripPattern: 'quantity:\\s*[\\d.,]+\\s*'` to also strip the quantity value, or use `quantity:.*$` to strip everything from `quantity:` to end-of-string. Mark as Claude's discretion — the locked decision says `'quantity:'` is the minimal pattern; the planner should note both options.

[VERIFIED: codebase — lib/utils/import.ts, lib/dal/import-formats.ts]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text + position extraction | Custom PDF.js integration | `unpdf` `extractTextItems` | Handles serverless worker setup, font loading, coordinate normalization |
| Monetary arithmetic in balance chain | Native `+`/`-` | `Decimal.js` via `new Decimal(str).plus(...)` | Project hard rule; floating-point errors accumulate across 100+ TR rows |
| Date parsing (TR Italian format) | Custom parser | `parseBankDate` from `lib/utils/import.ts` | Already handles Italian month names (`1 gen 2024`, `1 gennaio 2024`) and ISO, numeric formats |
| Amount parsing (TR `€ 1.006,85`) | Custom regex | `parseItalianAmount` from `lib/utils/import.ts` | Already handles `€`, comma/dot inversion, trims whitespace |
| Hash computation | Custom hash | `computeTransactionHash` / `computeDescriptionHash` in `lib/utils/import.ts` | Existing dedup contract — must not diverge |

---

## Common Pitfalls

### Pitfall 1: PDF Y-coordinate direction is inverted

**What goes wrong:** PDF.js uses a coordinate system where Y=0 is at the **bottom** of the page (not the top). Row ordering by Y descending gives rows from top to bottom. If you sort ascending on Y, rows come out bottom-to-top.

**Why it happens:** PDF spec uses a Cartesian coordinate system; HTML/CSS uses a screen coordinate system. `unpdf` exposes raw PDF.js coordinates without inversion.

**How to avoid:** Sort items by `y` **descending** (largest Y = top of page) to get reading order. Group items into rows by Y proximity (tolerance ~2–3 points for same-baseline detection).

**Warning signs:** Dates appear in reverse chronological order in the extracted rows.

### Pitfall 2: `delimiter` field is NOT NULL on `import_format_version`

**What goes wrong:** The schema has `delimiter: varchar("delimiter", { length: 4 }).notNull()`. Seeding a TR `importFormatVersion` row without a delimiter value will throw a DB constraint violation.

**Why it happens:** The column was designed for CSV — PDFs have no delimiter. Phase 56 (ADR 0013) moved it to `importFormatVersion` but did not make it nullable (ADR 0013 defers `parserKind` and `delimiter` nullability to a later phase).

**How to avoid:** Seed `delimiter: ','` as a placeholder for the TR format version. This is consistent: `headerSignature` is built by joining columns with `delimiter`, so `,` is the right separator for synthetic header matching in the detector.

**Warning signs:** Seed script fails with `null value violates not-null constraint`.

### Pitfall 3: Section boundary detection must discard "PANORAMICA TRANSAZIONI"

**What goes wrong:** TR PDFs contain a "PANORAMICA TRANSAZIONI" summary section that mirrors the data in "TRANSAZIONI SUL CONTO". If both sections are parsed, every transaction is imported twice with identical amounts — dedup by hash will catch these, but the imported count will be half of what the user expects.

**Why it happens:** The summary section appears before the detail section in the PDF's text flow.

**How to avoid:** Parse only the range of pages/items between the "TRANSAZIONI SUL CONTO" marker and the next major section header (or end of document). The section header detection must be tested with a real TR fixture.

**Warning signs:** `rowCount` equals `importedCount + duplicateCount` with `duplicateCount` unusually high on first import.

### Pitfall 4: Empty amount cell produces `null` from `parseItalianAmount`

**What goes wrong:** For `amountType: 'separate'`, each row has either a credit or a debit value. The absent column is represented as an empty string in the synthetic row. `parseItalianAmount('')` correctly returns `null`. If the PDF extractor places `''` in the wrong column (due to X-threshold miscalibration), the row will produce `amount: null` and be marked invalid.

**Why it happens:** X coordinate thresholds are derived from a sample PDF; layout may vary between statement periods or PDF versions.

**How to avoid:** Test with multiple real TR statement PDFs. Include a sanity check: if `importo_entrata === ''` AND `importo_uscita === ''` for a row that has a non-empty description, log a warning (column boundary may be miscalibrated).

**Warning signs:** High `invalidRows` count in `sampleValidity` during detection, or `amount: null` errors on TR rows.

### Pitfall 5: `scoreCandidate` delimiter warning on null delimiter

**What goes wrong:** `scoreCandidate` emits a warning when `parsed.delimiter !== format.platform.delimiter`. For PDF files, `parsed.delimiter = null` → the check `if (parsed.delimiter && ...)` evaluates to false, so **no warning is emitted**. This is the correct behavior. However, if the PDF parser mistakenly sets `delimiter: ','` in the `ParsedImportFile` output, the check triggers and the 5% delimiter weight may penalize the score.

**How to avoid:** Always set `delimiter: null` in the `ParsedImportFile` returned by `parseTradRepublicPdf`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pdf-parse` (flat text) | `unpdf` `extractTextItems` (positioned tokens) | ADR 0014 decision | Enables positional sign determination |
| Parsing contract on `platform` | Parsing contract on `import_format_version` | Phase 56 (ADR 0013) | TR PDF is a clean `importFormatVersion` row |
| Single format version per platform | Multiple versions per platform | Phase 56 | Future TR PDF v2 (if layout changes) is expressible |

**Deprecated/outdated:**
- `pdf-parse`: flat text only — rejected in ADR 0014, do not reference it.
- `platform.delimiter` / `platform.descriptionStripPattern`: columns dropped in migration 0022 (Phase 56) — all parsing contract lives on `importFormatVersion`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TR PDF uses Italian-format amounts (`1.006,85`) parseable by `parseItalianAmount` | Q7, Pattern 4 | Rows will produce `amount: null` and be invalid — caught by balance chain test |
| A2 | TR PDF dates match Italian month name format already handled by `parseBankDate` | Q6 | All rows will have `occurredAt: null` — caught in detector sample validity |
| A3 | X-coordinate column boundaries are stable across TR statement periods | Pattern 2, Pitfall 4 | Some rows will be misattributed to credit vs debit — caught by balance chain |
| A4 | "PANORAMICA TRANSAZIONI" appears before "TRANSAZIONI SUL CONTO" in document order | Pitfall 3 | May need to reverse section exclusion logic |
| A5 | `application/pdf` is the MIME type emitted by the browser for TR PDFs | Q4 | Initiate route rejects upload — fix by accepting `application/octet-stream` as fallback |

---

## Open Questions

1. **Exact X-coordinate thresholds for TR column bands**
   - What we know: `unpdf` returns `x` in points; TR has 4 data columns (data, descrizione, importo_entrata, importo_uscita) + balance
   - What's unclear: exact pixel/point positions — requires a real TR PDF fixture
   - Recommendation: Create a calibration test with a real fixture before hardcoding thresholds; the test fixture is Wave 0 work

2. **TR PDF date format**
   - What we know: ADR 0014 says `parseBankDate` already handles Italian month names; CONTEXT.md confirms D-07
   - What's unclear: whether TR uses `1 gen 2024` or `01/01/2024` or `2024-01-01`
   - Recommendation: Verify with real fixture; all three formats are supported by `parseBankDate` already

3. **Page ceiling value**
   - What we know: CONTEXT.md says "e.g. 50 pages — TR statements are typically 2–10 pages"
   - What's unclear: whether to define it as a constant or make it configurable
   - Recommendation: Hardcode `MAX_PDF_PAGES = 50` as a named constant in `trade-republic-pdf-parser.ts`

4. **`descriptionStripPattern` exact value**
   - What we know: D-06 says `'quantity:'`; analysis shows this leaves trailing number
   - What's unclear: whether trailing digits cause description hash divergence in practice
   - Recommendation: Seed `quantity:\\s*[\\d.,]+\\s*` to also strip the quantity value; or use `quantity:.*$`; confirm with real TR savings plan transactions

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `unpdf` | PDF token extraction | ✗ (not in package.json) | — | none — must install |
| Node.js | `unpdf` runtime | ✓ | 20+ (Vercel, Next.js 16) | — |
| `decimal.js` | Balance chain math | ✓ | 10.6.0 | — |
| Vitest | Test suite | ✓ | 4.1.5 | — |

**Missing dependencies with no fallback:**
- `unpdf` — must be installed: `yarn add unpdf`

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` |
| Quick run command | `yarn test --reporter=verbose tests/trade-republic-pdf-parser.test.ts` |
| Full suite command | `yarn test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PDF-01 | Size cap rejects files > 5 MB | unit | `yarn test tests/trade-republic-pdf-parser.test.ts` | ❌ Wave 0 |
| PDF-01 | Page ceiling rejects PDFs > 50 pages | unit | `yarn test tests/trade-republic-pdf-parser.test.ts` | ❌ Wave 0 |
| PDF-01 | `application/pdf` accepted in `InitiateUploadSchema` | unit | `yarn test lib/validations/__tests__/import.test.ts` | ✅ (needs extension) |
| PDF-02 | Section detection — "TRANSAZIONI SUL CONTO" extracted; "PANORAMICA TRANSAZIONI" discarded | unit | `yarn test tests/trade-republic-pdf-parser.test.ts` | ❌ Wave 0 |
| PDF-03 | Balance chain pass — valid TR fixture imports without error | unit | `yarn test tests/trade-republic-pdf-parser.test.ts` | ❌ Wave 0 |
| PDF-03 | Balance chain fail — tampered row produces explicit error, no rows imported | unit | `yarn test tests/trade-republic-pdf-parser.test.ts` | ❌ Wave 0 |
| PDF-03 | Credit/debit sign correct — positional X assignment | unit | `yarn test tests/trade-republic-pdf-parser.test.ts` | ❌ Wave 0 |
| PDF-04 | Detector matches TR synthetic headers with confidence ≥ 0.8 | unit | `yarn test tests/import-detector.test.ts` | ✅ (needs TR case) |
| PDF-04 | `normalizeTransactionRow` produces valid amount/date for TR rows | unit | `yarn test tests/import-detector.test.ts` | ✅ (needs TR case) |
| PDF-05 | `descriptionStripPattern` causes identical hash for `ETF savings plan quantity: 3` and `ETF savings plan quantity: 7` | unit | `yarn test tests/trade-republic-pdf-parser.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `yarn test tests/trade-republic-pdf-parser.test.ts tests/import-detector.test.ts`
- **Per wave merge:** `yarn test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/trade-republic-pdf-parser.test.ts` — covers PDF-01, PDF-02, PDF-03, PDF-05
- [ ] `tests/fixtures/import/trade-republic-sample.pdf` — real or synthetic TR fixture (minimum: 3 rows, 1 savings plan with `quantity:`)
- [ ] Extend `tests/import-detector.test.ts` — add TR synthetic fixture case for PDF-04
- [ ] Extend `lib/validations/__tests__/import.test.ts` — add `application/pdf` acceptance test for PDF-01

*(No framework install needed — Vitest 4.1.5 already configured)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | `verifySession` in initiate route; file ownership check via `getFileForUser` |
| V5 Input Validation | yes | Zod `InitiateUploadSchema`; page ceiling check in parser |
| V6 Cryptography | no | — |

### Known Threat Patterns for PDF Upload

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious PDF (zip bomb, JavaScript) | Tampering | `unpdf` uses serverless PDF.js with `isEvalSupported: false` (default) — JS in PDF is disabled |
| IDOR — user accesses another user's R2 object | Elevation of Privilege | `getFileForUser({userId, fileId})` ownership check before R2 read — already in place |
| Oversized PDF causing OOM in Lambda | Denial of Service | 5 MB hard cap in Zod schema + page ceiling in parser |
| SSRF via PDF embedded URL | Information Disclosure | `unpdf` does not follow URLs; extraction is purely content-parsing |
| Path traversal in objectKey | Tampering | `buildUserImportObjectKey` in `lib/dal/files.ts` namespaces by userId — already in place |

---

## Sources

### Primary (HIGH confidence)

- `/unjs/unpdf` (Context7) — `extractTextItems`, `getDocumentProxy`, `getMeta` API; `StructuredTextItem` shape; serverless build behavior
- `lib/services/import-parsers.ts` (codebase) — `ParsedImportFile` type, `parseImportFile` dispatch, size cap, `emptyResult` pattern
- `lib/services/import-format-detector.ts` (codebase) — `scoreCandidate`, delimiter scoring, header matching algorithm
- `lib/utils/import.ts` (codebase) — `normalizeTransactionRow`, `amountType: 'separate'` path, `descriptionStripPattern` application
- `lib/validations/import.ts` (codebase) — `MAX_IMPORT_FILE_SIZE_BYTES`, `IMPORT_CONTENT_TYPES`, `InitiateUploadSchema`
- `app/api/files/initiate/route.ts` (codebase) — presigned PUT flow, `createPresignedPutUrl` signature
- `scripts/seed.ts` (codebase) — `headerSignatureFor` computation
- `scripts/seed-data.ts` (codebase) — platform + importFormatVersion seed shapes, existing `amountType: 'separate'` example (Fineco)
- `lib/db/schema.ts` (codebase) — `importFormatVersion` columns, `delimiter NOT NULL` constraint

### Secondary (MEDIUM confidence)

- `docs/adr/0014-pdf-import-per-bank-template.md` — design decisions (per-bank template, unpdf, balance chain)
- `docs/adr/0013-import-format-owns-parsing-contract.md` — contract migration context
- `.planning/phases/57-pdf-import-trade-republic/57-CONTEXT.md` — locked decisions D-01 to D-08

### Tertiary (LOW confidence)

- None — all claims verified from codebase or official Context7 docs.

---

## Metadata

**Confidence breakdown:**
- `unpdf` API: HIGH — verified via Context7 (/unjs/unpdf, source reputation: High)
- Integration point: HIGH — verified by reading `import-parsers.ts` and `import.ts`
- Detector behavior: HIGH — verified by reading `import-format-detector.ts` and `scoreCandidate`
- Upload flow: HIGH — verified by reading `initiate/route.ts` and `import.ts` validations
- Balance chain algorithm: HIGH — Decimal.js is project standard; algorithm is standard
- Pitfalls: MEDIUM — PDF Y-coordinate inversion and section boundary issues are known PDF.js behaviors not verified with a real TR fixture

**Research date:** 2026-06-25
**Valid until:** 2026-08-25 (unpdf v1.x API is stable; TR PDF layout changes slowly)
