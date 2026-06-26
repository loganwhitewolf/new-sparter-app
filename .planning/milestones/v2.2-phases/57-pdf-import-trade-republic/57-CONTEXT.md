# Phase 57: pdf-import-trade-republic — Context

**Gathered:** 2026-06-25
**Status:** Ready for planning
**Source:** ADR Ingest Express Path (docs/adr/0014-pdf-import-per-bank-template.md + docs/adr/0013-import-format-owns-parsing-contract.md)

<domain>
## Phase Boundary

This phase delivers PDF import for Trade Republic bank statements. The user can upload a `.pdf` file and have its transactions imported via the existing pipeline (detector → normalizeTransactionRow → dedup → preview) unchanged.

**Prerequisite:** Phase 56 moved the parsing contract to `import_format_version`. Phase 57 builds on that clean model.

**Out of scope:** OCR/scanned PDFs, generic multi-bank parser, automatic categorization of TR descriptions.

</domain>

<decisions>
## Implementation Decisions

### D-01: Per-bank template, not generic
No universal PDF parser. Each bank gets a deterministic template that recognizes the document by markers (e.g. "TRADE REPUBLIC" + "TRANSAZIONI SUL CONTO") and extracts only the canonical movements section. Discards summaries, positions, and mirror sections (e.g. "PANORAMICA TRANSAZIONI"). Generic abstraction emerges from 2–3 concrete cases — not from one.

### D-02: Normalize to `ParsedImportFile`
The PDF parser produces the same intermediate structure `{headers, rows}` as CSV/XLSX, with **synthetic headers** (internal extractor contract, not text present in the file). The entire downstream pipeline remains unchanged: the detector re-recognizes the Platform by matching synthetic headers against the seeded Import Format.

### D-03: Sign via X-coordinate position + balance chain validation
`unpdf` (serverless-ready) gives token X coordinates. Each amount is attributed to the credit/debit column by positional X. The progressive balance chain (`prev_balance + amount == curr_balance`) certifies that no row was lost or merged. Mismatch → explicit error, **never** silent import of wrong numbers.

### D-04: `unpdf` is the PDF library (no `pdf-parse`)
`pdf-parse` gives flat text only, no coordinates → incompatible with the positional approach. `unpdf` is serverless-ready and provides token-level positions.

### D-05: Upload via presigned PUT — 5 MB cap + page ceiling
PDF upload follows the same presigned PUT path as CSV/XLSX. Validation: 5 MB hard cap and a defensive page ceiling. Both fail with an explicit error **before** the R2 upload.

### D-06: `descriptionStripPattern: 'quantity:'` for Trade Republic
Minimal strip pattern that neutralizes serial-variable parts in descriptions (e.g. `quantity: 3` in savings plans), so recurring rows aggregate into a single Expense. Configurable per Platform; acts only on new imports (hashes are persisted).

### D-07: TR date and amount format already supported
Date: Italian month names → already handled by `parseBankDate`. Amount: `€ 1.006,85` format → already handled by `parseItalianAmount` with `amountType: 'separate'`.

### D-08: PDF platform is a standard `import_format_version` with synthetic headers
A Trade Republic PDF Platform is represented as a normal `import_format_version` row with synthetic header columns (e.g. `data`, `descrizione`, `importo_entrata`, `importo_uscita`). No special `sourceFormat` field required yet — that can come when a second PDF bank is added.

### Claude's Discretion
- Exact synthetic header names for TR columns
- Whether to add `parserKind: 'pdf'` to `import_format_version` now or defer (ADR 0013 mentions it as a future possibility)
- Where to place the TR PDF parser (new file under `lib/import/parsers/` or inline in import flow)
- Whether the page ceiling is configurable or hardcoded (defensive, so hardcoded is fine)
- Exact error message wording for size/page violations and balance chain mismatches

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Design Contracts
- `docs/adr/0014-pdf-import-per-bank-template.md` — PDF import architecture: per-bank template, unpdf, balance chain validation
- `docs/adr/0013-import-format-owns-parsing-contract.md` — import_format_version owns the parsing contract (Phase 56 prerequisite)

### Import Pipeline (files the PDF path must feed into unchanged)
- `lib/import/import.ts` — main import flow (`importFile`), transaction from Phase 56
- `lib/import/detector.ts` — `scoreCandidate` / `detectFormat` — matches synthetic headers
- `lib/import/normalize.ts` — `normalizeTransactionRow` / `ImportPlatformConfig`
- `lib/import/hash.ts` — `computeTransactionHash` — must produce same output for PDF rows
- `lib/import/parser.ts` — CSV/XLSX parser (reference — PDF parser mirrors its `ParsedImportFile` output shape)

### Seed & Schema
- `scripts/seed-data.ts` — add TR platform + import_format_version with synthetic headers
- `lib/db/schema.ts` — `importFormatVersion` table shape (delimiter, amountType, descriptionStripPattern, etc.)

### Upload & R2
- `lib/actions/import-actions.ts` — presigned PUT action (extend for PDF MIME type + size/page cap)
- `app/(app)/import/` — upload UI (extend file accept to include `.pdf`)

</canonical_refs>

<specifics>
## Specific Ideas

- Trade Republic markers: "TRADE REPUBLIC" in metadata or first page + "TRANSAZIONI SUL CONTO" as section header
- Synthetic headers for TR: `data`, `descrizione`, `importo_entrata`, `importo_uscita` (matching `amountType: 'separate'`)
- Balance chain: TR PDFs include a progressive running balance column — use it for sign verification
- `unpdf` version: use latest stable, serverless-compatible
- File size cap: 5 MB (5 * 1024 * 1024 bytes) checked before presigned PUT request
- Page ceiling: defensive (e.g. 50 pages) — TR statements are typically 2–10 pages

</specifics>

<deferred>
## Deferred Ideas

- Tier-1 categorization patterns for TR descriptions (follow-up via regex-discovery + seed-patterns)
- PDF templates for additional banks
- Retroactive re-hash of already-imported history when descriptionStripPattern changes
- `parserKind: 'pdf'` field on `import_format_version` (follow-up when a second PDF bank is added)
- Generic multi-bank PDF parser (explicitly rejected in ADR 0014 — one concrete case is not enough)

</deferred>

---

*Phase: 57-pdf-import-trade-republic*
*Context gathered: 2026-06-25 via ADR Ingest Express Path*
