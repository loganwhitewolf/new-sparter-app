---
phase: quick-260615-dtm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/services/categorization-match.ts
  - lib/services/categorization.ts
  - tests/categorization-match.test.ts
  - scripts/regex-discovery.ts
  - .gitignore
  - package.json
  - docs/regex-discovery.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "Running `yarn regex:discover` over import fixtures produces a dated markdown report under .data/regex-discovery/"
    - "Coverage detection uses the same matcher as production (applyTier1Regex), so a description covered in prod is never reported as a gap"
    - "Uncovered descriptions are clustered by recurring merchant token; each cluster shows count, EUR total, samples, and a proposed word-boundary regex"
    - "A file whose layout matches no known import format is surfaced in the report, never silently skipped"
    - ".data/ is gitignored so real bank exports are never committed"
  artifacts:
    - path: "lib/services/categorization-match.ts"
      provides: "Pure (non-server-only) matcher module exporting applyTier1Regex + ActivePattern, importable from production and tsx scripts"
      contains: "export function applyTier1Regex"
    - path: "scripts/regex-discovery.ts"
      provides: "Bank-agnostic regex-discovery tool: parse via import layer, coverage via applyTier1Regex, cluster uncovered, write dated report"
      min_lines: 120
    - path: "docs/regex-discovery.md"
      provides: "Method doc: where reports land, how to re-run over time, how output flows into a seed-extras step"
      contains: "regex:discover"
  key_links:
    - from: "scripts/regex-discovery.ts"
      to: "lib/services/categorization-match.ts"
      via: "import applyTier1Regex"
      pattern: "applyTier1Regex"
    - from: "scripts/regex-discovery.ts"
      to: "lib/services/import-format-detector.ts"
      via: "parseImportFile + detectImportFormat"
      pattern: "detectImportFormat"
    - from: "lib/services/categorization.ts"
      to: "lib/services/categorization-match.ts"
      via: "re-export"
      pattern: "from './categorization-match'"
---

<objective>
Build a reusable, bank-agnostic regex-discovery tool. It ingests transaction export files from `.data/regex-discovery/` (gitignored real bank exports), reuses the production import layer to normalize any supported file into {description, amount} rows, detects which descriptions are NOT yet covered by the production categorization regex set, clusters the uncovered descriptions by recurring merchant token, and writes a dated markdown report proposing new regex patterns in the existing word-boundary style.

Purpose: Andrea re-runs this over time as descriptions change; each run surfaces only still-uncovered descriptions against the CURRENT pattern set. The human assigns subcategories to clusters afterward and persists chosen patterns as a new additive step in scripts/seed-extras.ts. THIS task builds and validates the tool only — it adds no real patterns (D-6, D-7).

Output: a pure matcher module (single source of truth for coverage), the discovery script, a yarn entry point, a `.data/` gitignore entry, and a short method doc. Validated against the existing import fixtures.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

# Production matcher to reuse VERBATIM (currently server-only — Task 1 extracts it)
@lib/services/categorization.ts

# Import layer to reuse (NOT server-only — directly reusable from a tsx script)
@lib/services/import-parsers.ts
@lib/services/import-format-detector.ts
@lib/utils/import.ts

# Operator DB connection convention to mirror (env resolution + pg Pool + drizzle)
@scripts/seed-extras.ts
@scripts/db-config.ts

# DAL whose query shape the script mirrors inline (do NOT import — it is server-only)
@lib/dal/import-formats.ts

# Pattern shape + persistence destination (for proposal/collision logic and the doc)
@scripts/seed-data.ts
@lib/utils/decimal.ts
</context>

<constraints>
CRITICAL — server-only conflict (the #1 correctness risk, locked decision D-4):
- `lib/services/categorization.ts` and `lib/dal/import-formats.ts` BOTH start with `import 'server-only'`. The `server-only` package throws unconditionally under tsx/Node (no `react-server` export condition). A plain script CANNOT import either module — it throws at import time.
- D-4 requires reusing `applyTier1Regex` VERBATIM, not reimplementing it. Resolution: Task 1 MOVES the pure function + its `ActivePattern`/`CategorizationResult` types into a new module with NO `server-only` guard, and `categorization.ts` re-exports them. Production behavior is unchanged (same function, single source of truth) and the script imports the identical function. Do NOT copy-paste the matcher body into the script.
- The format-loading DAL (`loadImportFormatsForDetection`) is also server-only and applies per-user access scoping. The script must NOT import it. Instead, load active GLOBAL-approved formats inline with a lightweight Drizzle query against `importFormatVersion` + `platform` (mirroring the DAL's global-approved branch), then pass the candidates to `detectImportFormat` (NOT server-only, reused directly).

Matcher fidelity (D-4): coverage MUST call `applyTier1Regex(description, amount, patterns)`. Patterns MUST be ordered like production: system patterns (userId null) first, then by `priority` ascending. The matcher already tests both the raw description AND the pure-number-stripped variant — do NOT pre-strip or re-normalize the description before calling it, or you will surface false gaps.

Money (CLAUDE.md hard rule): any EUR aggregation per cluster MUST use Decimal.js via `@/lib/utils/decimal` (`toDecimal`, `toDbDecimal`). Amounts are strings. Never use native `+`/`-` on amounts.

Language (CLAUDE.md): all script code, comments, logs, the report's structural labels, and docs are in English. Merchant tokens and sample descriptions echoed into the report are user data (may be Italian) — that is data, not developer strings. Run `yarn check:language` consideration after the script lands.

Layering: a script under `scripts/`. It may import pure helpers from `lib/services` and `lib/utils`; it must NOT import `server-only` modules. DB access uses the operator-env convention from `scripts/db-config.ts` exactly as `seed-extras.ts` does.

PII (D-2): `.data/` holds real personal financial exports. Task 2 MUST add `.data/` to `.gitignore`. Reports are written as `.data/regex-discovery/report-<YYYY-MM-DD>.md` inside the gitignored dir (D-5).
</constraints>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extract applyTier1Regex into a pure (non-server-only) matcher module</name>
  <files>lib/services/categorization-match.ts, lib/services/categorization.ts, tests/categorization-match.test.ts</files>
  <behavior>
    - applyTier1Regex imported from the NEW module returns the same result as before for a description matching a system pattern (subCategoryId, confidence, patternId, source='system_pattern').
    - It matches the pure-number-stripped variant: "PAGAMENTO 12345 COOP" matches a pattern containing the coop word-boundary token even though raw tokens include numbers.
    - It returns null when no pattern matches, and skips (does not throw on) an invalid regex pattern in the set.
    - First match in priority order wins when two patterns could match.
    - The new module imports WITHOUT throwing under tsx/Node (no server-only guard).
  </behavior>
  <action>
    Create `lib/services/categorization-match.ts` with NO `import 'server-only'`. Move the `ActivePattern` type (id, userId, pattern, subCategoryId, confidence, priority), the `CategorizationResult` type, and the entire `applyTier1Regex` function body from categorization.ts into this new file, byte-for-byte unchanged — including the `new RegExp(p.pattern, 'i')` construction, the stripped-description computation that splits on whitespace and filters out empty and pure-number tokens before rejoining, the `regex.test(description) || regex.test(stripped)` check, the source determination (userId null -> 'system_pattern' else 'user_pattern'), and the try/catch that skips invalid patterns without failing. In categorization.ts, remove the moved definitions and re-export them: `export { applyTier1Regex } from './categorization-match'` plus `export type { ActivePattern, CategorizationResult } from './categorization-match'`. Keep categorization.ts's `import 'server-only'` and everything else (loadActivePatterns, applyTier2History) intact so production import sites are unchanged. Confirm no other importer of these symbols breaks (they import from categorization.ts, which still re-exports). Write tests/categorization-match.test.ts covering the behaviors above, importing directly from categorization-match (proving it loads outside a server context).
  </action>
  <verify>
    <automated>yarn test run tests/categorization-match.test.ts</automated>
  </verify>
  <done>New pure module exports applyTier1Regex + ActivePattern + CategorizationResult; categorization.ts re-exports them; production import sites unchanged; new test passes; existing categorization-related tests still pass.</done>
</task>

<task type="auto">
  <name>Task 2: Build the regex-discovery script, gitignore .data/, add yarn entry, write method doc</name>
  <files>scripts/regex-discovery.ts, .gitignore, package.json, docs/regex-discovery.md</files>
  <action>
    Add `.data/` to `.gitignore` (append near the existing `tmp/` entry).

    Create scripts/regex-discovery.ts (English code/comments/logs). Mirror the operator-DB bootstrap from seed-extras.ts: call loadOperatorEnv(), resolveOperatorDatabaseTarget(), getOperatorDatabaseConfig({ target }), build new Pool(pgPoolConfigFromOperatorConfig(config)), drizzle(pool), and .finally(() => pool.end()), all guarded by the same executedDirectly check (resolved import.meta.url vs process.argv[1]). Import getOperatorDatabaseConfig, loadOperatorEnv, pgPoolConfigFromOperatorConfig, resolveOperatorDatabaseTarget from ./db-config. Handle a not-ok config result with a JSON error log and process.exit(1), same as seed-extras.

    Load coverage inputs from the DB (do NOT import the server-only DAL):
    1. Active GLOBAL patterns: query categorizationPattern where isActive = true AND userId IS NULL, selecting id, userId, pattern, subCategoryId, confidence, priority; order by priority ascending. Map to ActivePattern[] (import type ActivePattern from @/lib/services/categorization-match) and pass to applyTier1Regex. Also fetch a subCategoryId -> slug map (query subCategory id+slug) so collision notes can name the subcategory of any overlapping pattern.
    2. Active formats: query importFormatVersion innerJoin platform where both isActive = true, mirroring the global-approved branch of loadImportFormatsForDetection (ownerUserId null, visibility 'global', reviewStatus 'approved' on both). Shape each row into an ImportFormatCandidateInput exactly as the DAL's toCandidate does (id, platformId, version, headerSignature, isActive, platform:{ id, name, slug, delimiter, country, timestampColumn, descriptionColumn, amountType, amountColumn, positiveAmountColumn, negativeAmountColumn, multiplyBy, descriptionStripPattern }). Import type ImportFormatCandidateInput from @/lib/services/import-format-detector.

    Read every file in .data/regex-discovery/ (skip the script's own report-*.md outputs and non-data files; accept .csv/.txt/.xlsx/.xls). For each file:
    - parseImportFile(buffer, { fileName }) from @/lib/services/import-parsers.
    - detectImportFormat({ parsed, formats, userId: SCRIPT_USER_ID }) from @/lib/services/import-format-detector. Use a fixed local constant SCRIPT_USER_ID = 'regex-discovery' — detection's userId only seeds the transaction hash; coverage does not depend on it.
    - If detected.bestCandidate is null (unknown layout), SURFACE the file in an "Unmatched files" report section with the detector's errors/warnings and the top candidate's confidence + missingHeaders. Never silently skip it (D-3). Continue.
    - For a matched file, normalize each parsed row with normalizeTransactionRow(row, { ...best.platform, platformId: best.platformId }, { userId: SCRIPT_USER_ID, rowIndex }) from @/lib/utils/import. Keep only rows where valid is true, description is non-empty, and amount is non-null.

    Coverage: for each normalized row call applyTier1Regex(row.description, row.amount, patterns). A null result means UNCOVERED. Collect uncovered {description, amount} across matched files. Do NOT pre-strip/normalize the description before the call — the matcher does its own stripped-variant test (D-4).

    Cluster uncovered descriptions by recurring merchant token: lowercase, tokenize on whitespace, drop pure-number tokens and short tokens (length < 3), pick the most frequent significant token as the cluster key (simple top-token grouping; document the heuristic in a code comment). Per cluster aggregate: tx count, total EUR (sum with toDecimal(...).plus(...), format final total with toDbDecimal(...) — never native arithmetic), up to ~5 sample descriptions. Rank by tx count, then total EUR descending.

    Per cluster build a PROPOSED regex in the existing word-boundary style by escaping regex metacharacters in the token and wrapping it as a non-capturing word-boundary group matching the seed-data.ts pattern shape. Collision check at the token level: list existing patterns whose source text contains the token and name each one's subcategory slug via the id->slug map, so the human sees overlap. (Clusters are uncovered by construction, so literal regex-vs-regex overlap is expected to be empty; the token-level note is the useful signal.)

    Write the report to .data/regex-discovery/report-<YYYY-MM-DD>.md (local ISO date, no time). Sections: header (run date, files processed, total rows, covered vs uncovered counts); "Unmatched files"; one block per ranked cluster (merchant token, tx count, EUR total, sample descriptions, proposed regex in a fenced code block inside the REPORT, collision notes). End with a "Next step" line pointing to docs/regex-discovery.md. Log a one-line JSON summary to stdout on success and end the pool.

    Add "regex:discover": "tsx scripts/regex-discovery.ts" to package.json scripts (next to the db:seed-extras entries).

    Create docs/regex-discovery.md (English): what the tool does; input files live in .data/regex-discovery/ (gitignored, real PII); how to run (yarn regex:discover); why coverage reuses the production matcher (single source of truth via categorization-match.ts — fidelity guarantee); how re-runs naturally narrow to still-uncovered descriptions over time (D-5); and how to persist chosen patterns afterward as a NEW additive step in scripts/seed-extras.ts (idempotent INSERT into categorizationPattern guarded by existence of the (pattern, subCategoryId) pair, per the unique constraint) (D-6). Note docs/ is created by this task (the dir is currently empty/absent).
  </action>
  <verify>
    <automated>test -f docs/regex-discovery.md && grep -q 'data/' .gitignore && grep -q 'regex:discover' package.json && grep -q 'categorization-match' scripts/regex-discovery.ts && grep -q 'detectImportFormat' scripts/regex-discovery.ts && npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>.data/ is gitignored; regex:discover yarn script exists; docs/regex-discovery.md explains where reports land, how to re-run, and the seed-extras persistence path; the script imports applyTier1Regex from categorization-match and uses parseImportFile + detectImportFormat + normalizeTransactionRow; tsc passes.</done>
</task>

<task type="auto">
  <name>Task 3: Validate the tool end-to-end against existing import fixtures</name>
  <files>.data/regex-discovery/ (validation inputs — gitignored, ephemeral)</files>
  <action>
    Validate without waiting for real bank files (D-7). The repository's import fixtures are inline in test files (tests/import-detector.test.ts, tests/import-service.test.ts, tests/import.spec.ts) — there are no standalone fixture files. Build validation inputs from those inline fixtures:
    1. Create .data/regex-discovery/ (gitignored). Materialize at least one CSV whose header + sample rows match a seeded global format so detection succeeds. The seeded platforms (General, Satispay, Intesa SP, Intesa SP CC, Revolut, Fineco) and their column configs come from scripts/seed-data.ts / scripts/seed.ts — derive a valid header line and a handful of data rows for one of them (simplest is the General single-amount layout from import.spec.ts: a date,description,amount CSV). Include rows whose descriptions ARE covered by existing patterns (one containing COOP, one containing AMAZON) and rows that are clearly UNCOVERED (a repeated unknown merchant token across several rows) so clustering has signal.
    2. Drop one file with a deliberately unknown header layout so the "Unmatched files" path is exercised.
    3. Run yarn regex:discover. Confirm: command exits 0; a .data/regex-discovery/report-<date>.md is created; the report lists the unmatched file under "Unmatched files"; the covered descriptions (COOP/AMAZON) do NOT appear as gaps; the repeated unknown merchant appears as a ranked cluster with tx count, EUR total, samples, and a proposed word-boundary regex.
    If the local DB has no seeded global formats/patterns (detection finds nothing), the report should still be produced and should surface all files as unmatched — verify that degraded path produces a coherent report rather than crashing, and note the DB-seeding prerequisite in run output / the doc. Do NOT commit anything under .data/.
  </action>
  <verify>
    <automated>yarn regex:discover && ls .data/regex-discovery/report-*.md >/dev/null 2>&1</automated>
  </verify>
  <done>yarn regex:discover runs to completion and emits a dated report; covered descriptions are not flagged as gaps; uncovered descriptions cluster with count + EUR total + proposed regex; an unknown-layout file is surfaced under "Unmatched files"; nothing under .data/ is staged for commit.</done>
</task>

</tasks>

<verification>
- Production matcher behavior unchanged: existing categorization tests pass after the extract/re-export (Task 1).
- The new pure module loads under tsx without throwing (Task 1 direct-import test; the script running in Task 3).
- Coverage fidelity (D-4): the script calls applyTier1Regex with no pre-normalization; descriptions covered in production are not reported as gaps (Task 3 asserts COOP/AMAZON not flagged).
- Bank-agnostic reuse (D-3): detection/parsing/normalization come entirely from the existing import layer; unknown layouts are surfaced, never silently skipped (Task 3 "Unmatched files").
- Money safety: EUR aggregation uses Decimal helpers only (review the script for native arithmetic on amounts).
- PII safety (D-2): .data/ is gitignored; git status shows nothing under .data/ after Task 3.
- npx tsc --noEmit passes; consider yarn check:language after the script lands.
</verification>

<success_criteria>
- yarn regex:discover ingests files from .data/regex-discovery/, reuses the production import layer + matcher, and writes a dated markdown report.
- Uncovered descriptions cluster by merchant token, ranked by tx count then EUR total, each with samples, a proposed word-boundary regex, and token-level collision notes.
- Unknown-layout files are reported, not dropped.
- The matcher is a single source of truth shared by production and the script (no reimplementation).
- A method doc explains re-running over time and the seed-extras persistence path.
- No real patterns are added and no PII is committed by this task (D-6, D-7).
</success_criteria>

<output>
Create `.planning/quick/260615-dtm-reusable-regex-discovery-tool-bank-agnos/260615-dtm-SUMMARY.md` when done.
</output>
