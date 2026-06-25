# Requirements — Milestone v2.2: PDF Import

**Defined:** 2026-06-25
**Source:** Design locked in the 2026-06-25 grill (ADR 0013, ADR 0014, CONTEXT.md, memory `project_pdf_import`)
**Status:** Scoped — ready for roadmap

Two ordered capabilities: a behavior-preserving model refactor (Phase 56) that the PDF import (Phase 57) builds on.

## v2.2 Requirements

### Import Format Model (refactor — behavior-preserving)

The parsing contract is owned by `import_format_version`, not `platform`. See `docs/adr/0013-import-format-owns-parsing-contract.md`.

- [x] **IFMT-01**: The parsing contract (`delimiter`, `*Column`, `dateFormat`, `dateReplace`, `decimalReplace`, `multiplyBy`, `descriptionStripPattern`, `amountType`) lives on `import_format_version`; `platform` retains only identity (`name`/`slug`/`country`/`visibility`/`ownerUserId`).
- [x] **IFMT-02**: The 6 existing CSV/XLSX imports produce identical `transactionHash` values before and after the refactor — proven by a regression test over real fixtures.
- [ ] **IFMT-03**: Existing `platform` / `import_format_version` rows in production are migrated by an additive, idempotent `seed-extras` step (no `drizzle-kit push`; migration via `drizzle-kit generate` + `scripts/migrate.ts`).
- [ ] **IFMT-04**: Multiple format versions per platform become expressible and selectable (versioning works — the `unique(platformId, version)` constraint is now meaningful).
- [ ] **IFMT-05**: The detector (`scoreCandidate`), `normalizeTransactionRow` / `ImportPlatformConfig`, the detection DAL, seed scripts, and the format wizard operate against the moved contract with no behavioral regression.

### PDF Import (Trade Republic)

Per-bank PDF parsing normalized into the existing tabular pipeline. See `docs/adr/0014-pdf-import-per-bank-template.md`.

- [ ] **PDF-01**: The user can upload a PDF statement (`.pdf` / `application/pdf`) via presigned PUT, with a 5 MB cap and a defensive page ceiling that fail with an explicit error.
- [ ] **PDF-02**: The system recognizes a Trade Republic statement by markers and extracts **only** the "TRANSAZIONI SUL CONTO" section, discarding summaries, positions, and mirror sections (e.g. "PANORAMICA TRANSAZIONI").
- [ ] **PDF-03**: Each amount's sign is determined positionally (X coordinates via `unpdf`) and cross-checked against the running-balance chain; a mismatch produces an explicit error and imports no data.
- [ ] **PDF-04**: PDF-extracted rows pass through the detector, `normalizeTransactionRow`, dedup, and preview unchanged (synthetic headers → `ParsedImportFile`).
- [ ] **PDF-05**: Trade Republic carries a minimal `descriptionStripPattern` (`quantity:`) so recurring rows aggregate into a single Expense.

## Future Requirements (deferred)

- Tier-1 categorization patterns for Trade Republic descriptions (Interest payment → income, Stamp Duty → essential, Savings plan Bitcoin → investment) — follow-up via `regex-discovery` + `seed-patterns`.
- PDF templates for additional banks (the generic abstraction emerges from 2–3 concrete cases).
- Retroactive re-hash of already-imported history when a `descriptionStripPattern` changes.

## Out of Scope

- **OCR / scanned PDFs** (type C) — Trade Republic is a text-layer PDF; image-based statements are a separate, costlier problem.
- **Generic multi-bank PDF parser** — rejected in ADR 0014; "almost-right" extraction on financial data is worse than no import.
- **Automatic categorization as part of import** — import only produces correct transactions; nature/subcategory stays downstream as for every Platform.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| IFMT-01 | Phase 56 | Complete |
| IFMT-02 | Phase 56 | Complete |
| IFMT-03 | Phase 56 | Pending |
| IFMT-04 | Phase 56 | Pending |
| IFMT-05 | Phase 56 | Pending |
| PDF-01 | Phase 57 | Pending |
| PDF-02 | Phase 57 | Pending |
| PDF-03 | Phase 57 | Pending |
| PDF-04 | Phase 57 | Pending |
| PDF-05 | Phase 57 | Pending |
