# Quick Task 260728-mpo: Fineco platform + format cleanup - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning
**Branch:** `gsd/taxonomy-leisure` (already checked out — append seed-extras here; do not create a new branch)

<domain>
## Task Boundary

Production cleanup for Fineco:

1. Merge duplicate Fineco **platforms** into the canonical seed platform `slug = 'fineco'`, for all users.
2. Make the provided `;`-delimited Fineco import contract the **single global approved** format on that platform; remove other Fineco format versions; update `seed-data.ts` Fineco v1 so fresh installs match.

</domain>

<decisions>
## Implementation Decisions

### 1) Platform survivor
- Survivor = `platform.slug = 'fineco'` (canonical seed).
- Duplicates = other platforms matching `name ILIKE 'Fineco%'` OR `slug LIKE 'fineco-%'` (wizard mint suffixes), excluding the survivor.
- Reassign all `import_format_version.platform_id` from duplicates → survivor.
- Then delete duplicate platform rows (cascade/format handling must be ordered safely — formats may need reassignment before platform delete).

### 2) Format contract to keep (promote to global)
Canonical parsing contract (from the provided private format):

- `delimiter`: `;`
- `header_signature`: `Data_Operazione;Data_Valuta;Entrate;Uscite;Descrizione;Descrizione_Completa;Stato;Moneymap`
- `description_column`: `Descrizione_Completa`
- `secondary_description_column`: `Descrizione`
- `amount_type`: `separate`
- `amount_column`: null
- `positive_amount_column`: `Entrate`
- `negative_amount_column`: `Uscite`
- `timestamp_column`: `Data_Operazione`
- `date_format`: `DD/MM/YYYY`
- `date_replace`: true
- `decimal_replace`: false
- `multiply_by`: 1
- `description_strip_pattern`: `\s+Carta N\..*$`
- Target row: `visibility = 'global'`, `review_status = 'approved'`, `owner_user_id = null`, `is_active = true`

Also update `scripts/seed-data.ts` Fineco `importFormatVersions` entry (version 1) to this contract so fresh installs match. `headerSignature` in seed.ts is derived via `headerSignatureFor()` — ensure seed columns produce the same signature OR set notes accordingly. **Important:** seed `headerSignatureFor` joins timestamp/description/amount columns with delimiter — the full CSV header string above may differ from that derivation; mirror the TR CSV seed-extras pattern: store the **full** `header_signature` as provided for detection, and keep parsing columns as listed.

### 3) FK reassignment before deletes
- After promoting/upserting the survivor global format: reassign `file.import_format_version_id` from any Fineco format versions that will be deleted → the kept format id.
- Then delete all other `import_format_version` rows for the Fineco survivor platform (and any leftover formats still on duplicate platforms before platform delete).
- Prefer **hard delete** of obsolete formats after FK reassignment (user chose soft-delete alternative C was rejected; 2A implies delete).

### Claude's Discretion
- Implement as **idempotent `seed-extras` STEPS** (this branch already has taxonomy seed-extras). Possibly two named steps: `merge-duplicate-fineco-platforms` then `ensure-fineco-moneymap-global-format` (or one combined step if safer atomically — prefer one transaction per step, clear logs).
- Do **not** use `drizzle-kit push`. SQL migrations only if schema change is required — this task should be data-only via seed-extras.
- Version number for the kept global format: if an existing global already matches the header signature, reuse it (update columns in place). Else insert/update at a free `(platformId, version)` slot; if consolidating to a single row, collapse to one active global (e.g. keep lowest version or rewrite v1 and delete others — prefer **one remaining global row**; private Fineco formats deleted after file reassignment).
- Match naming/style of `ensure-trade-republic-csv-global-format`.
- Tests: unit/integration covering idempotency of the new step(s) if the repo already tests seed-extras steps; otherwise minimal focused tests for helpers / step no-op paths.
- Italian UI N/A; English code/comments/logs.

</decisions>

<specifics>
## Specific Ideas

- User example private format id 123 / platform_id 7 in prod is illustrative — do not hardcode ids; resolve by slug `fineco` and header signature.
- Old seed Fineco used `,` + `timestamp_column: Data` — detection must switch to the new header so Moneymap-style exports match.

</specifics>

<canonical_refs>
## Canonical References

- `scripts/seed-extras.ts` — `ensure-trade-republic-csv-global-format` precedent
- `scripts/seed-data.ts` — Fineco platform + importFormatVersions entry
- `scripts/seed.ts` — `headerSignatureFor`
- ADR 0013 / 0015 platform + format model in `lib/db/schema.ts`
- CLAUDE.md — seeds additive; seed-extras for row updates; no drizzle-kit push in prod

</canonical_refs>
