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
// Clusters with fewer than this many transactions are collapsed into a compact "long tail"
// section instead of getting a full proposal block. Override with --min-tx=N (N >= 1).
const DEFAULT_MIN_TX = 2

// Tokens that pass the length/number filter but carry no merchant signal: currency codes,
// Italian legal-entity forms, banking/statement filler, common short prepositions/articles,
// and payment-processor names (whose own name dominates the description — the real merchant
// is the token after the `*`, e.g. "Paypal *Vodafoneita"). Extend as new noise surfaces.
const STOPWORDS = new Set<string>([
  // currency codes
  'eur', 'usd', 'gbp', 'chf', 'jpy',
  // legal-entity forms
  'srl', 'srls', 'sas', 'spa', 'snc', 'sapa', 'soc', 'scs', 'ssd', 'coop.',
  // banking / statement filler
  'fil', 'fil.', 'pos', 'pag', 'pagamento', 'carta', 'contactless', 'addebito',
  'bonifico', 'prelievo', 'acquisto', 'operazione', 'commissione',
  // common short prepositions / articles (Italian)
  'del', 'dei', 'della', 'delle', 'degli', 'con', 'per', 'tra', 'fra',
  'una', 'uno', 'gli', 'che', 'non', 'sul', 'sulla',
  // payment processors (the merchant is the token after the `*`)
  'paypal', 'sumup', 'satispay', 'nexi', 'stripe', 'klarna', 'scalapay', 'izettle',
  // structured bank-statement prefixes (Italian bonifico / dossier text) — the merchant
  // or real signal is elsewhere in the line, not in these wrappers
  'ord', 'ordinante', 'ben', 'beneficiario', 'banca', 'causale', 'canale', 'trn',
  'iban', 'dossier', 'mand', 'sdd', 'accredito',
])

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

// All active formats — NOT just global-approved. This is a local operator analysis tool
// run on the operator's own exports, so it should match against any defined format,
// including private/draft formats users created via the import wizard (e.g. the `;`-delimited
// Fineco layout that exists only as private drafts and was never promoted to global). The
// detector picks the highest-confidence match >= 0.8; non-matching junk formats are harmless.
// Shaped via the same toCandidate as loadImportFormatsForDetection.
async function loadAllActiveFormats(database: Db): Promise<ImportFormatCandidateInput[]> {
  const rows = await database
    .select({
      id: importFormatVersion.id,
      platformId: importFormatVersion.platformId,
      version: importFormatVersion.version,
      headerSignature: importFormatVersion.headerSignature,
      isActive: importFormatVersion.isActive,
      platformName: platform.name,
      platformSlug: platform.slug,
      platformDelimiter: importFormatVersion.delimiter,
      platformCountry: platform.country,
      platformTimestampColumn: importFormatVersion.timestampColumn,
      platformDescriptionColumn: importFormatVersion.descriptionColumn,
      platformAmountType: importFormatVersion.amountType,
      platformAmountColumn: importFormatVersion.amountColumn,
      platformPositiveAmountColumn: importFormatVersion.positiveAmountColumn,
      platformNegativeAmountColumn: importFormatVersion.negativeAmountColumn,
      platformMultiplyBy: importFormatVersion.multiplyBy,
      platformDescriptionStripPattern: importFormatVersion.descriptionStripPattern,
    })
    .from(importFormatVersion)
    .innerJoin(platform, eq(importFormatVersion.platformId, platform.id))
    .where(and(eq(importFormatVersion.isActive, true), eq(platform.isActive, true)))

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

// Strip leading processor/marker punctuation so "*Vodafoneita" tokenizes as "vodafoneita",
// and trailing separators so "Ord:" / "Beneficiario:" tokenize as "ord" / "beneficiario"
// (then caught by stopwords). Internal dots/apostrophes are preserved (e.g. "claude.ai",
// "ced.su", "www.generali.it").
export function normalizeToken(token: string): string {
  return token.replace(/^[*#@]+/, '').replace(/[:;,]+$/, '')
}

export function isSignificantToken(token: string): boolean {
  // Reject short tokens, any token containing a digit (store/filiale codes like "i011",
  // transaction refs, "0000150"), and stopwords. A merchant identified only by a
  // digit-bearing token is rare and is better caught during manual labeling.
  return token.length >= MIN_TOKEN_LENGTH && !/\d/.test(token) && !STOPWORDS.has(token)
}

// Heuristic: lowercase, tokenize on whitespace, strip marker punctuation, drop pure-number,
// short (<3), and stopword tokens, then pick the single most frequent significant token in
// the description as that row's cluster key. Ties resolve to the first-seen token.
export function clusterKeyFor(description: string): string | null {
  const tokens = description
    .toLocaleLowerCase('it-IT')
    .split(/\s+/)
    .map(normalizeToken)
    .filter(isSignificantToken)
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
  minTx: number
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
        'Run `yarn db:seed && yarn db:seed-extras && yarn db:seed-patterns` against this database, then re-run `yarn regex:discover`.',
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

  // Clusters arrive ranked (count desc, then EUR). Split into significant (>= minTx) shown
  // in full, and the long tail (< minTx) collapsed into a compact scannable list.
  const significant = input.clusters.filter((c) => c.count >= input.minTx)
  const tail = input.clusters.filter((c) => c.count < input.minTx)

  lines.push(`## Uncovered clusters (>= ${input.minTx} tx)`)
  lines.push('')
  if (significant.length === 0) {
    lines.push('_No clusters meet the threshold — see the long tail below, or re-run with `--min-tx=1`._')
  } else {
    let rank = 1
    for (const cluster of significant) {
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

  lines.push(`## Long tail (< ${input.minTx} tx)`)
  lines.push('')
  if (tail.length === 0) {
    lines.push('_None._')
  } else {
    lines.push(
      'One-off / low-frequency tokens — re-run with `--min-tx=1` to expand these into full ' +
        'proposal blocks, or wait for them to recur.',
    )
    lines.push('')
    lines.push('| Token | Tx | EUR | Sample |')
    lines.push('|---|---|---|---|')
    for (const cluster of tail) {
      const sample = (cluster.samples[0] ?? '').replace(/\|/g, '\\|')
      lines.push(`| \`${cluster.token}\` | ${cluster.count} | ${cluster.totalEur} | ${sample} |`)
    }
  }
  lines.push('')

  lines.push('## Next step')
  lines.push('')
  lines.push(
    'Assign a subcategory to each cluster you want to keep, then append the pattern to `scripts/seed-patterns-data.ts` and run `yarn db:seed-patterns`. See `docs/regex-discovery.md` for the full workflow.',
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

// Parse the --min-tx=N flag (N >= 1). Falls back to DEFAULT_MIN_TX when absent or invalid.
export function parseMinTx(argv: string[]): number {
  const arg = argv.find((a) => a.startsWith('--min-tx='))
  if (!arg) return DEFAULT_MIN_TX
  const n = Number.parseInt(arg.slice('--min-tx='.length), 10)
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_MIN_TX
}

async function runDiscovery(database: Db, minTx: number): Promise<void> {
  const patterns = await loadActiveGlobalPatterns(database)
  const slugById = await loadSubCategorySlugMap(database)
  const formats = await loadAllActiveFormats(database)
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
    minTx,
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
      minTx,
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
  const minTx = parseMinTx(process.argv.slice(2))

  runDiscovery(db, minTx)
    .catch((error: unknown) => {
      console.error(JSON.stringify({ event: 'regex_discovery_failed', error: String(error) }))
      process.exit(1)
    })
    .finally(() => pool.end())
}
