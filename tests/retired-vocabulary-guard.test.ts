import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

/**
 * RETIRE-01 (D-15): the Deviation, Baseline and Noise Threshold machinery must be gone from the
 * codebase, with no dead references left behind. This is the automated repo-wide guard for that
 * requirement — before it existed, RETIRE-01 was proven only by a manual grep plus three
 * single-file source assertions scoped to Phase 83's own files.
 *
 * Named for the REQUIREMENT, not for a component or a page. Phase 82's RETIRE-04 proof lived in
 * `tests/dashboard-filters.test.ts` — named after the component it happened to sit beside — and
 * was deleted as collateral when Phase 84 removed that component, silently destroying the proof.
 * A file named after the requirement cannot be collected that way.
 *
 * Scope: `app/`, `lib/`, `components/` — every `.ts`/`.tsx` file, recursively. The `tests/`
 * directory is deliberately NOT scanned: guard tests must be free to name the vocabulary they
 * forbid, and test files are not the interface or the shipped codebase RETIRE-01 speaks about.
 */

const SOURCE_ROOTS = ['app', 'lib', 'components']

/**
 * Retired identifiers, matched as whole words. Every entry was exported from `lib/` or referenced
 * from `app/`/`components/` before Phase 84's retirement sweep (84-03, 84-04).
 */
const RETIRED_IDENTIFIERS = [
  // Preset filter machinery (RETIRE-02's shared helpers, retired with the Deviation)
  'DashboardPreset',
  'DASHBOARD_PRESETS',
  'dashboardPresetToDateRange',
  'DashboardFilters',
  'DashboardSort',
  'parseDashboardFilters',
  // Deviation engine
  'getCategoryDeviations',
  'getDeviationDateRanges',
  'buildDeviationDataset',
  'buildDeviationMap',
  'computeDeviation',
  'DeviationData',
  'DeviationDateRanges',
  'getOverviewComparisonRanges',
  // Noise Threshold and Baseline
  'DEVIATION_NOISE_THRESHOLD',
  'noiseThreshold',
  'baselineAmount',
]

/**
 * Retired vocabulary matched as a SUBSTRING rather than a whole word, so that a re-introduced
 * member of the family is caught even under a name this list never anticipated —
 * `DeviationBadge`, `DeviationChart`, `CategoryDeviationRow`, `NoiseThresholdInput`, and so on.
 * A word-boundary match would miss every one of them.
 *
 * Why `Baseline`/`baseline` is NOT in this list: both have live, unrelated senses in this
 * codebase — `restoreRefundBaseline` (v2.8 reimbursement lifecycle,
 * `lib/services/transaction-pairs.ts`) and Tailwind's `items-baseline`. The retired Baseline
 * reached the code only as `baselineAmount`, which is asserted as a whole word above.
 */
const RETIRED_SUBSTRINGS = ['Deviation', 'Deviazione', 'NoiseThreshold', 'noiseThreshold']

/**
 * Only this guard file is exempt. Verified empirically at authoring time: with the allowlist
 * emptied entirely, every identifier and substring above returns zero hits across all three
 * source roots — no production file needs an exemption, so none is granted. An exemption for a
 * page or a component would punch the hole exactly where a regression would land.
 */
const ALLOWLIST = [/^tests\/retired-vocabulary-guard\.test\.ts$/]

function isAllowlisted(relativePath: string): boolean {
  return ALLOWLIST.some((pattern) => pattern.test(relativePath))
}

function walkSourceTree(dir: string, fileList: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue

    const filePath = join(dir, entry)

    if (statSync(filePath).isDirectory()) {
      walkSourceTree(filePath, fileList)
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      fileList.push(filePath)
    }
  }

  return fileList
}

function collectSourceFiles(): string[] {
  const cwd = process.cwd()
  const files: string[] = []

  for (const root of SOURCE_ROOTS) {
    walkSourceTree(join(cwd, root), files)
  }

  return files.map((filePath) => filePath.slice(cwd.length + 1))
}

type Hit = { file: string; line: number; content: string }

function scanTree(matches: (line: string) => boolean): { hits: Hit[]; filesScanned: number } {
  const files = collectSourceFiles().filter((relativePath) => !isAllowlisted(relativePath))
  const hits: Hit[] = []

  for (const relativePath of files) {
    const lines = readFileSync(`${process.cwd()}/${relativePath}`, 'utf-8').split('\n')

    lines.forEach((line, index) => {
      if (matches(line)) {
        hits.push({ file: relativePath, line: index + 1, content: line.trim() })
      }
    })
  }

  return { hits, filesScanned: files.length }
}

function scanForIdentifier(identifier: string) {
  return scanTree((line) => new RegExp(`\\b${identifier}\\b`).test(line))
}

function scanForSubstring(fragment: string) {
  return scanTree((line) => line.includes(fragment))
}

function describeHits(hits: Hit[]): string {
  return hits.map((hit) => `${hit.file}:${hit.line}\n  ${hit.content}`).join('\n')
}

describe('RETIRE-01 — retired vocabulary guard', () => {
  describe('anti-vacuity controls', () => {
    test('POSITIVE CONTROL: the walk reaches the real source tree, not an empty set', () => {
      const files = collectSourceFiles()

      expect(files.length).toBeGreaterThan(200)
      expect(files.some((file) => file.startsWith('app/'))).toBe(true)
      expect(files.some((file) => file.startsWith('lib/'))).toBe(true)
      expect(files.some((file) => file.startsWith('components/'))).toBe(true)
    })

    test('POSITIVE CONTROL: the identifier scan can find a symbol that IS present', () => {
      // buildYearSeries is a live Phase 82 export. If the scan cannot find it, every green
      // "zero occurrences" assertion below is vacuous.
      const { hits } = scanForIdentifier('buildYearSeries')

      expect(hits.length).toBeGreaterThan(0)
      expect(hits.some((hit) => hit.file.startsWith('lib/'))).toBe(true)
    })

    test('POSITIVE CONTROL: the substring scan can find a fragment that IS present', () => {
      // Substring semantics, not word-boundary: 'YearSerie' is a fragment of buildYearSeries.
      const { hits } = scanForSubstring('YearSerie')

      expect(hits.length).toBeGreaterThan(0)
    })

    test('the allowlist never exempts a production source file', () => {
      // The guard is worth only as much as its narrowest exemption. A future edit that
      // allowlists a page or a component to make this suite pass must fail here instead.
      const exempted = collectSourceFiles().filter((relativePath) => isAllowlisted(relativePath))

      expect(exempted, `Allowlist exempts production source: ${exempted.join(', ')}`).toEqual([])
      expect(ALLOWLIST).toHaveLength(1)
    })
  })

  describe('retired identifiers are absent (whole-word)', () => {
    test.each(RETIRED_IDENTIFIERS)('%s has zero occurrences', (identifier) => {
      const { hits } = scanForIdentifier(identifier)

      expect(hits, `Found ${hits.length} occurrence(s) of ${identifier}:\n${describeHits(hits)}`).toEqual([])
    })
  })

  describe('retired vocabulary families are absent (substring)', () => {
    test.each(RETIRED_SUBSTRINGS)('nothing named *%s* survives', (fragment) => {
      const { hits } = scanForSubstring(fragment)

      expect(hits, `Found ${hits.length} occurrence(s) of ${fragment}:\n${describeHits(hits)}`).toEqual([])
    })
  })
})
