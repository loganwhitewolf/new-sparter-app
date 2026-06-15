# Regex discovery

A reusable, bank-agnostic tool for finding transaction descriptions that the production
categorization regex set does **not** yet cover, and proposing new word-boundary patterns
for them. Re-run it over time as your real descriptions change; each run surfaces only the
descriptions still uncovered against the **current** pattern set.

## What it does

1. Reads every transaction export in `.data/regex-discovery/`.
2. Reuses the **production import layer** (`parseImportFile` + `detectImportFormat` +
   `normalizeTransactionRow`) to turn any supported file into normalized
   `{ description, amount }` rows. Files whose layout matches no known import format are
   surfaced in the report under **Unmatched files** — never silently skipped.
3. For each normalized row, calls `applyTier1Regex` — **the exact function production uses**
   — to decide coverage. A `null` result means the description is uncovered.
4. Clusters the uncovered descriptions by recurring merchant token, aggregates a tx count
   and EUR total per cluster, and proposes a word-boundary regex for each.
5. Writes a dated markdown report: `.data/regex-discovery/report-<YYYY-MM-DD>.md`.

## Input files (real PII)

Drop your bank exports into `.data/regex-discovery/`. Supported extensions: `.csv`, `.txt`,
`.xlsx`, `.xls`. This directory is **gitignored** (`.data/`) because it holds real personal
financial data — it must never be committed. The tool writes its reports into the same
gitignored directory, so reports are never committed either.

## How to run

```bash
yarn regex:discover
```

The tool connects to the operator database using the same env resolution as
`yarn db:seed-extras` (`DATABASE_URL` for local; `--staging` / `--production` flags select
the corresponding `*_DATABASE_URL`). It loads the active **global** patterns and import
formats from that database, so coverage reflects exactly what production would categorize.

### Seeding prerequisite

Coverage and format detection depend on seeded global patterns and import formats. If the
target database has none (e.g. a fresh local DB), the tool runs in a **degraded** mode: it
still produces a coherent report, but every file is surfaced as unmatched and nothing can be
evaluated for coverage. Seed first, then re-run:

```bash
yarn db:seed && yarn db:seed-extras
yarn regex:discover
```

## Why coverage reuses the production matcher

`applyTier1Regex` lives in `lib/services/categorization-match.ts`, a pure module with **no
`server-only` guard**, so both production (`categorization.ts` re-exports it) and this script
import the **same function**. There is a single source of truth for coverage: a description
that production would categorize can never be reported here as a gap. The script passes the
description to the matcher **unmodified** — the matcher already tests both the raw and the
pure-number-stripped variant internally, so pre-stripping would create false gaps.

## Re-running over time

Because coverage is evaluated against the **current** pattern set on every run, each report
naturally narrows to the descriptions that are *still* uncovered. After you persist new
patterns (below), the next run will no longer list the descriptions those patterns now cover.

## Persisting chosen patterns

This tool **only proposes** patterns — it never writes any to the database. After you pick a
subcategory for a cluster you want to keep, persist the chosen pattern as a **new additive
step** in `scripts/seed-extras.ts` (the project's append-only seed model — never edit shipped
`seed-data.ts` shapes):

1. Append a new named async step to the `STEPS` array.
2. In the step, resolve the target subcategory id by slug, then `INSERT` into
   `categorizationPattern`. Make it idempotent against the
   `categorization_pattern_unique (pattern, subCategoryId)` constraint — e.g. guard with an
   existence check on the `(pattern, subCategoryId)` pair, or use `onConflictDoNothing()`.
3. Run `yarn db:seed-extras` (and `:staging` / `:production` as needed).

Keep developer-facing code, comments, and logs in English; merchant tokens and sample
descriptions echoed into the report are user data and may be Italian.
