// Bank-agnostic regex-discovery tool.
//
// Ingests transaction export files from .data/regex-discovery/ (gitignored real bank
// exports), reuses the PRODUCTION import layer to normalize any supported file into
// {description, amount} rows, detects which descriptions are NOT yet covered by the
// production Tier-1 categorization regex set, clusters the uncovered descriptions by
// recurring merchant token, and writes a dated markdown report proposing new patterns.
//
// Coverage fidelity (D-4): coverage calls applyTier1Regex from the PURE matcher module
// (lib/services/categorization-match.ts) — the same function production uses. We never
// reimplement the matcher, so a description covered in prod can never be reported as a gap.
//
// The script must NOT import server-only modules (categorization.ts, the import-formats
// DAL). It loads active global patterns/formats inline with lightweight Drizzle queries.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { categorizationPattern, importFormatVersion, platform, subCategory } from '../lib/db/schema'
import {
  getOperatorDatabaseConfig,
  isDirectSupabaseHost,
  loadOperatorEnv,
  operatorConnectionFailureHint,
  pgPoolConfigFromOperatorConfig,
  resolveOperatorDatabaseTarget,
} from './db-config'
import { applyTier1Regex, type ActivePattern } from '@/lib/services/categorization-match'
import { parseImportFile } from '@/lib/services/import-parsers'
import {
  detectImportFormat,
  type ImportFormatCandidateInput,
} from '@/lib/services/import-format-detector'
import { normalizeTransactionRow } from '@/lib/utils/import'
import { toDecimal, toDbDecimal } from '@/lib/utils/decimal'

type Db = ReturnType<typeof drizzle>

// detection's userId only seeds the transaction hash; coverage does not depend on it.
const SCRIPT_USER_ID = 'regex-discovery'
const INPUT_DIR = resolve(process.cwd(), '.data', 'regex-discovery')
const SUPPORTED_EXTENSIONS = ['.csv', '.txt', '.xlsx', '.xls']
const MAX_SAMPLES_PER_CLUSTER = 5
const MIN_TOKEN_LENGTH = 3

type UncoveredRow = { description: string; amount: string }

type Cluster = {
  token: string
  count: number
  totalEur: string
  samples: string[]
  proposedRegex: string
  collisions: string[]
}

type UnmatchedFile = {
  fileName: string
  topConfidence: number | null
  missingHeaders: string[]
  errors: string[]
  warnings: string[]
}

// ---------------------------------------------------------------------------
// DB loaders (inline — never import the server-only DAL)
// ---------------------------------------------------------------------------

// Active GLOBAL patterns, ordered exactly like production: system patterns (userId
// null) first, then by priority ascending. The script only surfaces global coverage,
// so the userId-null filter doubles as the system-only scope.
async function loadActiveGlobalPatterns(database: Db): Promise<ActivePattern[]> {
  const rows = await database
    .select({
      id: categorizationPattern.id,
      userId: categorizationPattern.userId,
      pattern: categorizationPattern.pattern,
      subCategoryId: categorizationPattern.subCategoryId,
      confidence: categorizationPattern.confidence,
      priority: categorizationPattern.priority,
    })
    .from(categorizationPattern)
    .where(and(eq(categorizationPattern.isActive, true), isNull(categorizationPattern.userId)))
    .orderBy(asc(categorizationPattern.priority))

  return rows as ActivePattern[]
}

// subCategoryId -> slug map so collision notes can name the subcategory of any
// pattern whose source text overlaps a proposed token.
async function loadSubCategorySlugMap(database: Db): Promise<Map<number, string>> {
  const rows = await database
    .select({ id: subCategory.id, slug: subCategory.slug })
    .from(subCategory)
  return new Map(rows.map((row) => [row.id, row.slug]))
}

// Active global-approved formats. Mirrors the global-approved branch of
// loadImportFormatsForDetection (ownerUserId null, visibility 'global', reviewStatus
// 'approved' on both importFormatVersion and platform), shaped via the same toCandidate.
async function loadActiveGlobalFormats(database: Db): Promise<ImportFormatCandidateInput[]> {
  const rows = await database
    .select({
      id: importFormatVersion.id,
      platformId: importFormatVersion.platformId,
      version: importFormatVersion.version,
      headerSignature: importFormatVersion.headerSignature,
      isActive: importFormatVersion.isActive,
      platformName: platform.name,
      platformSlug: platform.slug,
      platformDelimiter: platform.delimiter,
      platformCountry: platform.country,
      platformTimestampColumn: platform.timestampColumn,
      platformDescriptionColumn: platform.descriptionColumn,
      platformAmountType: platform.amountType,
      platformAmountColumn: platform.amountColumn,
      platformPositiveAmountColumn: platform.positiveAmountColumn,
      platformNegativeAmountColumn: platform.negativeAmountColumn,
      platformMultiplyBy: platform.multiplyBy,
      platformDescriptionStripPattern: platform.descriptionStripPattern,
    })
    .from(importFormatVersion)
    .innerJoin(platform, eq(importFormatVersion.platformId, platform.id))
    .where(
      and(
        eq(importFormatVersion.isActive, true),
        eq(platform.isActive, true),
        isNull(importFormatVersion.ownerUserId),
        isNull(platform.ownerUserId),
        eq(importFormatVersion.visibility, 'global'),
        eq(platform.visibility, 'global'),
        eq(importFormatVersion.reviewStatus, 'approved'),
        eq(platform.reviewStatus, 'approved'),
      ),
    )

  return rows.map((row) => ({
    id: row.id,
    platformId: row.platformId,
    version: row.version,
    headerSignature: row.headerSignature,
    isActive: row.isActive,
    platform: {
      id: row.platformId,
      name: row.platformName,
      slug: row.platformSlug,
      delimiter: row.platformDelimiter,
      country: row.platformCountry,
      timestampColumn: row.platformTimestampColumn,
      descriptionColumn: row.platformDescriptionColumn,
      amountType: row.platformAmountType,
      amountColumn: row.platformAmountColumn,
      positiveAmountColumn: row.platformPositiveAmountColumn,
      negativeAmountColumn: row.platformNegativeAmountColumn,
      multiplyBy: row.platformMultiplyBy,
      descriptionStripPattern: row.platformDescriptionStripPattern,
    },
  }))
}

// ---------------------------------------------------------------------------
// Clustering + proposal helpers
// ---------------------------------------------------------------------------

function isSignificantToken(token: string): boolean {
  return token.length >= MIN_TOKEN_LENGTH && !/^\d+$/.test(token)
}

// Heuristic: lowercase, tokenize on whitespace, drop pure-number and short (<3) tokens,
// then pick the single most frequent significant token in the description as that row's
// cluster key (simple top-token grouping). Ties resolve to the first-seen token.
function clusterKeyFor(description: string): string | null {
  const tokens = description.toLocaleLowerCase('it-IT').split(/\s+/).filter(isSignificantToken)
  if (tokens.length === 0) return null

  const counts = new Map<string, number>()
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1)

  let bestToken: string | null = null
  let bestCount = 0
  for (const token of tokens) {
    const count = counts.get(token) ?? 0
    if (count > bestCount) {
      bestCount = count
      bestToken = token
    }
  }
  return bestToken
}

function escapeRegex(token: string): string {
  return token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Proposed regex in the existing word-boundary style (see scripts/seed-data.ts patterns):
// a non-capturing word-boundary group around the escaped token, case-insensitive at use.
function proposedRegexFor(token: string): string {
  return `(?:\\b${escapeRegex(token)}\\b)`
}

// Token-level collision note: existing patterns whose source text contains the token,
// named by their subcategory slug. Clusters are uncovered by construction so literal
// regex overlap is expected empty; this token-level signal is the useful overlap hint.
function collisionsFor(
  token: string,
  patterns: ActivePattern[],
  slugById: Map<number, string>,
): string[] {
  const notes: string[] = []
  for (const p of patterns) {
    if (p.pattern.toLocaleLowerCase('it-IT').includes(token)) {
      const slug = slugById.get(p.subCategoryId) ?? `sub_category_id=${p.subCategoryId}`
      notes.push(`pattern \`${p.pattern}\` → ${slug}`)
    }
  }
  return notes
}

function buildClusters(
  uncovered: UncoveredRow[],
  patterns: ActivePattern[],
  slugById: Map<number, string>,
): Cluster[] {
  const groups = new Map<string, UncoveredRow[]>()
  for (const row of uncovered) {
    const key = clusterKeyFor(row.description)
    if (!key) continue
    const bucket = groups.get(key)
    if (bucket) bucket.push(row)
    else groups.set(key, [row])
  }

  const clusters: Cluster[] = []
  for (const [token, rows] of groups) {
    // EUR total via Decimal.js — never native arithmetic on amounts (CLAUDE.md hard rule).
    let total = toDecimal('0')
    for (const row of rows) total = total.plus(toDecimal(row.amount))

    const samples: string[] = []
    for (const row of rows) {
      if (samples.length >= MAX_SAMPLES_PER_CLUSTER) break
      if (!samples.includes(row.description)) samples.push(row.description)
    }

    clusters.push({
      token,
      count: rows.length,
      totalEur: toDbDecimal(total),
      samples,
      proposedRegex: proposedRegexFor(token),
      collisions: collisionsFor(token, patterns, slugById),
    })
  }

  // Rank by tx count, then total EUR descending (compare via Decimal, not native).
  clusters.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return toDecimal(b.totalEur).comparedTo(toDecimal(a.totalEur))
  })
  return clusters
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------

function localIsoDate(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function renderReport(input: {
  runDate: string
  filesProcessed: number
  totalRows: number
  coveredCount: number
  uncoveredCount: number
  unmatchedFiles: UnmatchedFile[]
  clusters: Cluster[]
  patternCount: number
  degraded: boolean
}): string {
  const lines: string[] = []
  lines.push(`# Regex discovery report — ${input.runDate}`)
  lines.push('')
  lines.push(`- Files processed: ${input.filesProcessed}`)
  lines.push(`- Active global patterns loaded: ${input.patternCount}`)
  lines.push(`- Total normalized rows: ${input.totalRows}`)
  lines.push(`- Covered: ${input.coveredCount}`)
  lines.push(`- Uncovered: ${input.uncoveredCount}`)
  if (input.degraded) {
    lines.push('')
    lines.push(
      '> **Degraded run:** no active global import formats and/or patterns were found in the database. ' +
        'Every file is surfaced as unmatched and nothing can be evaluated for coverage. ' +
        'Run `yarn db:seed && yarn db:seed-extras` against this database, then re-run `yarn regex:discover`.',
    )
  }
  lines.push('')

  lines.push('## Unmatched files')
  lines.push('')
  if (input.unmatchedFiles.length === 0) {
    lines.push('_None — every input file matched a known import format._')
  } else {
    for (const file of input.unmatchedFiles) {
      const confidence = file.topConfidence === null ? 'n/a' : file.topConfidence.toFixed(2)
      lines.push(`### \`${file.fileName}\``)
      lines.push(`- Top candidate confidence: ${confidence}`)
      if (file.missingHeaders.length > 0) lines.push(`- Missing headers: ${file.missingHeaders.join(', ')}`)
      if (file.errors.length > 0) lines.push(`- Errors: ${file.errors.join('; ')}`)
      if (file.warnings.length > 0) lines.push(`- Warnings: ${file.warnings.join('; ')}`)
      lines.push('')
    }
  }
  lines.push('')

  lines.push('## Uncovered clusters')
  lines.push('')
  if (input.clusters.length === 0) {
    lines.push('_No uncovered descriptions clustered — either everything is covered or no data rows were normalized._')
  } else {
    let rank = 1
    for (const cluster of input.clusters) {
      lines.push(`### ${rank}. \`${cluster.token}\``)
      lines.push(`- Transactions: ${cluster.count}`)
      lines.push(`- EUR total: ${cluster.totalEur}`)
      lines.push('- Sample descriptions:')
      for (const sample of cluster.samples) lines.push(`  - ${sample}`)
      lines.push('- Proposed pattern:')
      lines.push('')
      lines.push('```regex')
      lines.push(cluster.proposedRegex)
      lines.push('```')
      if (cluster.collisions.length > 0) {
        lines.push('- Token-level collisions (existing patterns containing this token):')
        for (const note of cluster.collisions) lines.push(`  - ${note}`)
      } else {
        lines.push('- Token-level collisions: none')
      }
      lines.push('')
      rank += 1
    }
  }
  lines.push('')

  lines.push('## Next step')
  lines.push('')
  lines.push(
    'Assign a subcategory to each cluster you want to keep, then persist the chosen patterns as a NEW additive step ' +
      'in `scripts/seed-extras.ts`. See `docs/regex-discovery.md` for the full workflow.',
  )
  lines.push('')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Core run
// ---------------------------------------------------------------------------

function listInputFiles(): string[] {
  let entries: string[]
  try {
    entries = readdirSync(INPUT_DIR)
  } catch {
    // Directory absent — treat as no input files (the report still renders).
    return []
  }
  return entries.filter((name) => {
    // Skip the script's own report outputs and non-data files.
    if (/^report-\d{4}-\d{2}-\d{2}\.md$/.test(name)) return false
    const lower = name.toLocaleLowerCase('en-US')
    if (!SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) return false
    try {
      return statSync(resolve(INPUT_DIR, name)).isFile()
    } catch {
      return false
    }
  })
}

async function runDiscovery(database: Db): Promise<void> {
  const patterns = await loadActiveGlobalPatterns(database)
  const slugById = await loadSubCategorySlugMap(database)
  const formats = await loadActiveGlobalFormats(database)
  const degraded = formats.length === 0 || patterns.length === 0

  mkdirSync(INPUT_DIR, { recursive: true })
  const fileNames = listInputFiles()

  const uncovered: UncoveredRow[] = []
  const unmatchedFiles: UnmatchedFile[] = []
  let totalRows = 0
  let coveredCount = 0

  for (const fileName of fileNames) {
    const buffer = readFileSync(resolve(INPUT_DIR, fileName))
    const parsed = await parseImportFile(buffer, { fileName })
    const detected = detectImportFormat({ parsed, formats, userId: SCRIPT_USER_ID })

    if (!detected.bestCandidate) {
      // Unknown layout — surface it, never silently skip (D-3).
      const top = detected.candidates[0]
      unmatchedFiles.push({
        fileName,
        topConfidence: top ? top.confidence : null,
        missingHeaders: top ? top.missingHeaders : [],
        errors: detected.errors,
        warnings: detected.warnings,
      })
      continue
    }

    const best = detected.bestCandidate
    let rowIndex = 0
    for (const row of parsed.rows) {
      rowIndex += 1
      const normalized = normalizeTransactionRow(
        row,
        { ...best.platform, platformId: best.platformId },
        { userId: SCRIPT_USER_ID, rowIndex },
      )
      if (!normalized.valid || !normalized.description || normalized.amount === null) continue

      totalRows += 1
      // D-4: pass the description unmodified — applyTier1Regex does its own stripped-variant test.
      const result = applyTier1Regex(normalized.description, normalized.amount, patterns)
      if (result) {
        coveredCount += 1
      } else {
        uncovered.push({ description: normalized.description, amount: normalized.amount })
      }
    }
  }

  const clusters = buildClusters(uncovered, patterns, slugById)
  const runDate = localIsoDate()
  const report = renderReport({
    runDate,
    filesProcessed: fileNames.length,
    totalRows,
    coveredCount,
    uncoveredCount: uncovered.length,
    unmatchedFiles,
    clusters,
    patternCount: patterns.length,
    degraded,
  })

  const reportPath = resolve(INPUT_DIR, `report-${runDate}.md`)
  writeFileSync(reportPath, report, 'utf8')

  console.log(
    JSON.stringify({
      event: 'regex_discovery_succeeded',
      reportPath,
      filesProcessed: fileNames.length,
      unmatchedFiles: unmatchedFiles.length,
      totalRows,
      coveredCount,
      uncoveredCount: uncovered.length,
      clusters: clusters.length,
      degraded,
    }),
  )
}

// ---------------------------------------------------------------------------
// Runner (only when executed directly)
// ---------------------------------------------------------------------------

const executedDirectly =
  typeof process.argv[1] === 'string' &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])

if (executedDirectly) {
  loadOperatorEnv()

  const target = resolveOperatorDatabaseTarget()
  const configResult = getOperatorDatabaseConfig({ target })

  if (!configResult.ok) {
    console.error(JSON.stringify({ event: 'regex_discovery_failed', target, error: configResult.error }))
    process.exit(1)
  }

  const { config, diagnostics } = configResult

  console.log(
    JSON.stringify({ event: 'regex_discovery_connection', target: diagnostics.target, host: diagnostics.host }),
  )

  if (isDirectSupabaseHost(diagnostics.host)) {
    const hint = operatorConnectionFailureHint(diagnostics.host, diagnostics.target)
    if (hint) console.warn(JSON.stringify({ event: 'regex_discovery_connection_warning', message: hint }))
  }

  const pool = new Pool(pgPoolConfigFromOperatorConfig(config))
  const db = drizzle(pool)

  runDiscovery(db)
    .catch((error: unknown) => {
      console.error(JSON.stringify({ event: 'regex_discovery_failed', error: String(error) }))
      process.exit(1)
    })
    .finally(() => pool.end())
}
