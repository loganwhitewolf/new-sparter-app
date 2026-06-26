# Phase 56: import-format-refactor - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning
**Source:** ADR Ingest (docs/adr/0013) — synthesized manually because the ADR is Italian and the deterministic adr-parser only maps English headers; decisions below are lifted verbatim-in-substance from ADR 0013 and the 2026-06-25 grill.

<domain>
## Phase Boundary

**Behavior-preserving** refactor: move the entire parsing contract off the `platform` table and onto `import_format_version`, leaving `platform` as pure identity. No user-visible behavior changes; no PDF; no categorization changes. This phase exists to unblock real per-platform format versioning and to give Phase 57 (PDF import) a clean model to graft onto.

The fix completes a half-finished design: `import_format_version` is already versioned (`unique(platformId, version)`), but the column mapping that *should* vary per version lives on the non-versioned parent `platform` — so versioning does not actually work today.
</domain>

<decisions>
## Implementation Decisions (LOCKED — ADR 0013)

### Contract ownership
- The parsing contract moves to `import_format_version`: `delimiter`, `descriptionColumn`, `amountType`, `amountColumn`, `positiveAmountColumn`, `negativeAmountColumn`, `timestampColumn`, `dateFormat`, `dateReplace`, `decimalReplace`, `multiplyBy`, `descriptionStripPattern`.
- `platform` retains ONLY identity: `id`, `ownerUserId`, `visibility`, `reviewStatus`, `name`, `slug`, `country`, `isActive`, timestamps.
- Multiple `import_format_version` rows per platform must become expressible — the `unique(platformId, version)` constraint becomes meaningful (IFMT-04).

### Behavior preservation (the invariant that makes this verifiable)
- The 6 existing CSV/XLSX imports (General, Satispay, Intesa SP, Intesa SP CC, Revolut, Fineco) MUST produce identical `transactionHash` values before and after (IFMT-02).
- A regression test over real fixtures is the safety net — recommended to write FIRST, before moving columns.

### Migration
- Schema change via `drizzle-kit generate` + `scripts/migrate.ts`. NEVER `drizzle-kit push` in production.
- Existing `platform` / `import_format_version` rows in production are migrated by an additive, idempotent `seed-extras` step (copy contract columns from `platform` into the corresponding `import_format_version`, then the platform columns are dropped) (IFMT-03).
- `seed-data.ts` shapes and `seed.ts` (`headerSignatureFor`, the `importFormatVersion` insert) are reworked so the contract is seeded on `import_format_version` (IFMT-05).

### Consumers to update (no behavioral regression — IFMT-05)
- `scoreCandidate` in `lib/services/import-format-detector.ts` reads `format.platform.timestampColumn` etc. → must read the contract from the format version.
- `normalizeTransactionRow` / `ImportPlatformConfig` in `lib/utils/import.ts`.
- `loadImportFormatsForDetection` in `lib/dal/import-formats.ts` (the join shape that feeds the detector).
- The format wizard (`lib/services/import-format-wizard.ts`) and user-owned private platforms/formats.

### Claude's Discretion
- Whether to keep the platform contract columns nullable through a transition migration vs drop in one step (as long as the seed-extras data copy runs before any drop and the result is idempotent).
- Exact TS type shape for the moved contract (e.g. whether `ImportPlatformConfig` is renamed to an `ImportFormatConfig`), as long as the public behavior of `normalizeTransactionRow`/detector is unchanged.
- Internal ordering of tasks, provided the regression fixture/test (IFMT-02) lands before the column move.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract
- `docs/adr/0013-import-format-owns-parsing-contract.md` — THIS phase's locked decision
- `docs/adr/0014-pdf-import-per-bank-template.md` — why this refactor matters (Phase 57 grafts onto the clean model; informs but is NOT in scope here)
- `CONTEXT.md` — glossary: **Platform** (pure identity), **Import Format** (versioned parsing contract)

### Code touched
- `lib/db/schema.ts` — `platform` (≈ line 253), `importFormatVersion` (≈ line 289)
- `lib/services/import-format-detector.ts` — `scoreCandidate` reads `format.platform.*`
- `lib/utils/import.ts` — `ImportPlatformConfig`, `normalizeTransactionRow`
- `lib/dal/import-formats.ts` — `loadImportFormatsForDetection`
- `lib/services/import.ts` — `analyzeFile` / `importFile` (consume `best.platform` config)
- `lib/services/import-format-wizard.ts` — format wizard
- `scripts/seed-data.ts` (platform shapes), `scripts/seed.ts` (`headerSignatureFor`, importFormatVersion insert), `scripts/seed-extras.ts` (new additive STEP)
- `drizzle/migrations/` — generated SQL migration
</canonical_refs>

<specifics>
## Specific Ideas

- 6 seeded platforms today carry the contract; Fineco is the richest example (`amountType: separate`, `positiveAmountColumn: Entrate`, `negativeAmountColumn: Uscite`, `descriptionStripPattern` for Fineco boilerplate).
- `headerSignatureFor()` in `seed.ts` derives `headerSignature` by joining contract columns with the delimiter — after the move it reads those from the format-version seed shape.
- Test fixtures: real CSV/XLSX samples already exist under `tests/` (see `import-parsers-xlsx.test.ts`, `import-detector.test.ts`, `import-service.test.ts`) — base the `transactionHash` regression on these.
</specifics>

<deferred>
## Deferred Ideas

- A `sourceFormat` / `parserKind` (`csv|xlsx|pdf`) column on `import_format_version` — natural home once PDF lands, but NOT this phase (Phase 57).
- PDF parsing, synthetic headers, `unpdf` — all Phase 57.
</deferred>

<scope_fence>
## Out of Scope (hard fence)

- Any user-visible behavior change — this is behavior-preserving.
- PDF import, `unpdf`, synthetic headers, per-bank templates → Phase 57.
- Categorization / nature changes.
- `sourceFormat` column or any net-new capability on the format model.
</scope_fence>

---

*Phase: 56-import-format-refactor*
*Context gathered: 2026-06-25 via ADR Ingest (docs/adr/0013), manual synthesis*
