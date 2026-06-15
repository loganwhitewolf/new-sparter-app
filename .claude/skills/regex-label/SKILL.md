---
name: regex-label
description: Label a regex-discovery report and persist chosen categorization patterns. Use when the user has a `.data/regex-discovery/report-*.md` (from `yarn regex:discover`) and wants to turn its uncovered-merchant clusters into new categorization regex patterns. Trigger: `/regex-label [report-path]`.
---

# regex-label

Turn a regex-discovery report into committed categorization patterns. The discovery tool (`yarn regex:discover`, see `docs/regex-discovery.md`) only **proposes**; this skill is the human-in-the-loop labeling step that decides which clusters become real patterns and persists them.

This is **judgment work** — prefer running it on Opus. Each chosen pattern silently categorizes user transactions forever, so precision matters more than coverage.

## Inputs

- **Report path** — the `$ARGUMENTS` value, or the newest `.data/regex-discovery/report-*.md` if none given.
- The report lives under `.data/` (gitignored, real financial data). **Never `git add` or commit anything under `.data/`.**

## Hard rules (inherited from CLAUDE.md)

- **Seeds are additive.** Persist new patterns as a NEW named step appended to the `STEPS` array in `scripts/seed-extras.ts`. Never edit `seed-data.ts` shapes.
- **Matcher fidelity.** A proposed regex must actually fire in production. Production matching is `applyTier1Regex` (`lib/services/categorization-match.ts`): `new RegExp(pattern, 'i')` tested against the raw description AND a pure-number-stripped variant; case-insensitive; first match by ascending `priority` wins. Use the existing word-boundary style from `seed-data.ts` (`(?:\\bmerchant\\b|...)`).
- **Domain vocabulary.** Map to subcategory slugs using `CONTEXT.md` terminology. Only map to **active** subcategories that actually exist.
- **Language.** Step code, comments, logs in English. Merchant tokens / sample descriptions are user data and may stay Italian.
- **Unique constraint.** `categorization_pattern_unique (pattern, sub_category_id)` — inserts must be idempotent (`onConflictDoNothing()` or an existence guard).
- System patterns use `userId = null`.

## Procedure

### 1. Read the report
Read the report at the resolved path. Extract, per ranked cluster: merchant token, tx count, EUR total, sample descriptions, the tool's proposed regex, and any collision notes. Also note the **Unmatched files** section (layouts the import layer didn't recognize) — surface those to the user separately; they are a format-coverage problem, not a pattern problem.

### 2. Load the valid target taxonomy
Query the operator DB for active subcategories so proposals map to real slugs (same env resolution as `yarn db:seed-extras`):

```bash
# active subcategories with their parent category, as JSON
yarn tsx -e "import {drizzle} from 'drizzle-orm/node-postgres';import {Pool} from 'pg';import {eq} from 'drizzle-orm';import {subCategory,category} from './lib/db/schema';const p=new Pool({connectionString:process.env.DATABASE_URL});const db=drizzle(p);const rows=await db.select({slug:subCategory.slug,name:subCategory.name,cat:category.slug}).from(subCategory).innerJoin(category,eq(subCategory.categoryId,category.id)).where(eq(subCategory.isActive,true));console.log(JSON.stringify(rows,null,0));await p.end();"
```

If the DB is unreachable, fall back to the slugs in `scripts/seed-data.ts` (the `subCategories` shapes), but flag that they may be stale relative to `seed-extras.ts` renames.

### 3. Propose mappings (interactive)
Walk clusters in rank order (highest tx count / EUR impact first). For each, propose:
- **subCategorySlug** — chosen from the active taxonomy, justified in one line.
- **pattern** — a word-boundary regex in the `seed-data.ts` style. Generalize to the merchant, do not overfit a single description. Escape regex metacharacters.
- **confidence** — default `0.85`–`0.9` for a clear merchant token; lower if the token is ambiguous.
- **priority** — default near `100` (the column default). Use a *lower* number only when the pattern must be evaluated before a broader existing one. Never give a generic token a low priority that would shadow specific patterns.

Present them compactly and let the user confirm, edit, drop, or merge clusters. Skip noise (one-off strings, numeric junk). Do not invent a subcategory for a cluster that has no good home — ask.

### 4. Validate before persisting
For each confirmed pattern:
- **Fires:** `new RegExp(pattern, 'i')` matches the cluster's sample descriptions (and their number-stripped variant). Sanity-check with a quick node/tsx snippet.
- **No false positives:** review the report's collision notes; if the token also appears in descriptions belonging to a different category, tighten the regex (word boundaries, anchoring, negative lookahead like the existing `\\beni\\b(?!.*plenitude)` pattern) or lower the confidence.
- **Not a duplicate:** the `(pattern, subCategoryId)` pair isn't already present.

### 5. Persist as a seed-extras step
Append ONE new idempotent step to `scripts/seed-extras.ts`:
- Add an `async function <descriptive-name>(database: Db)` that, for each confirmed pattern: resolves the target `subCategory.id` by slug (skip with a log if the slug is missing), then `INSERT`s into `categorizationPattern` with `{ userId: null, pattern, subCategoryId, confidence, priority, description }`, using `.onConflictDoNothing()` (idempotent against the unique constraint). Log a one-line English summary of rows inserted.
- Register it in the `STEPS` array: `{ name: 'regex-discovery-<YYYY-MM-DD>', run: <fn> }`.

### 6. Verify
- `yarn check:language` (the step is dev-facing English; user-data tokens are allowed but confirm no developer strings slipped into Italian).
- `npx tsc --noEmit` passes.
- If a DB is available: `yarn db:seed-extras`, then `yarn regex:discover` again — the labeled clusters should no longer appear as gaps (this is the closed-loop proof).

### 7. Commit
Commit only the `scripts/seed-extras.ts` change (and any doc note), with a conventional message. **Confirm `git status` shows nothing staged under `.data/`.** Do not commit the report or any input file.

## Notes
- Re-runs are self-narrowing: because coverage runs against the current pattern set, once a step is seeded the next discovery report drops those descriptions automatically.
- Staging/production: the same step runs via `yarn db:seed-extras:staging` / `:production` when the operator promotes it.
