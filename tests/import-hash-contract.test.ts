/**
 * Regression contract: pins the exact transactionHash each CSV fixture produces
 * under the CURRENT (pre-refactor) code.
 *
 * Purpose: Plans 02–04 move the parsing contract from `platform` to
 * `import_format_version`. Re-running this test GREEN after those changes is the
 * proof that no transactionHash drifted (IFMT-02, ADR 0013).
 *
 * Rules:
 * - No DB, no R2, no network — pure unit test.
 * - The expected hashes are hard-coded hex literals captured from the current
 *   codebase; they are NOT self-referential (not derived at runtime from the
 *   function under test).
 * - descriptionStripPattern for fineco mirrors today's production row
 *   (set via seed-extras STEP `set-fineco-description-strip-pattern`).
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseImportFile } from '../lib/services/import-parsers'
import { normalizeTransactionRow, type ImportPlatformConfig } from '../lib/utils/import'
import { importFormatVersions as seedFormatVersions, platforms as seedPlatforms } from '../scripts/seed-data'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fixturePath = (name: string) => join(process.cwd(), 'tests', 'fixtures', 'import', name)

/** Fixed userId so hashes are deterministic across machines and environments. */
const FIXED_USER_ID = 'hash-contract-user'

/**
 * Build an ImportPlatformConfig from the format-version seed shape (ADR 0013).
 * The contract now lives on importFormatVersions; platforms holds identity only.
 * descriptionStripPattern is taken directly from the format-version seed shape
 * (Fineco carries it; all others are null).
 */
function buildConfig(
  slug: string,
  descriptionStripPattern: string | null,
): ImportPlatformConfig {
  const pIdx = seedPlatforms.findIndex((s) => s.slug === slug)
  const p = seedPlatforms[pIdx]
  if (!p) throw new Error(`Seed platform not found: ${slug}`)
  // Synthetic id: index-based since seed-data no longer carries hardcoded ids (ADR 0015).
  const syntheticId = pIdx + 1
  const fv = seedFormatVersions.find((v) => v.platformSlug === slug)
  if (!fv) throw new Error(`Seed format version not found for platform: ${slug}`)
  return {
    id: syntheticId,
    platformId: syntheticId,
    timestampColumn: fv.timestampColumn,
    descriptionColumn: fv.descriptionColumn,
    descriptionStripPattern,
    amountType: fv.amountType,
    amountColumn: fv.amountColumn ?? null,
    positiveAmountColumn: fv.positiveAmountColumn ?? null,
    negativeAmountColumn: fv.negativeAmountColumn ?? null,
    multiplyBy: fv.multiplyBy,
  }
}

// ---------------------------------------------------------------------------
// Fixture definitions
// Each fixture declares the platform slug, the descriptionStripPattern that
// mirrors today's production platform row, and the expected per-row hashes.
//
// Hash literals were captured by running the normalizeTransactionRow pipeline
// against each fixture before any Phase 56 changes, then baked here as static
// expectations.
// ---------------------------------------------------------------------------

const FIXTURES: Array<{
  fileName: string
  slug: string
  descriptionStripPattern: string | null
  // Per-row expectations (one entry per data row in the CSV)
  expectedHashes: string[]
  // First-row secondary pins to catch sign/multiplier/date drift
  firstRow: { amount: string; occurredAt: string }
}> = [
  {
    fileName: 'general.csv',
    slug: 'general',
    descriptionStripPattern: null,
    expectedHashes: [
      'fc2ca4889376fba7960c8a2bc5327bc9f16d93b14a5f14876eb7bb1e1ee3c827',
      'fc2ca4889376fba7960c8a2bc5327bc9f16d93b14a5f14876eb7bb1e1ee3c827',
      '1fc456b31126a629194304335b28ab4ffa7879f6428d62c0eb6e87b7ecfcd88d',
    ],
    firstRow: { amount: '-12.34', occurredAt: '2026-01-02T10:30:00.000Z' },
  },
  {
    fileName: 'crypto-com.csv',
    slug: 'crypto-com',
    descriptionStripPattern: null,
    expectedHashes: [
      '4ac485838f8c0a15480d3bb83c7b4bb3bf6552430e64fcd3b8859b8357959f86',
      'b71410658b601c8285d35114d6bef5f1317d3ee0f6aea2ac911d027f5cbacbbb',
      '4ac485838f8c0a15480d3bb83c7b4bb3bf6552430e64fcd3b8859b8357959f86',
    ],
    firstRow: { amount: '1.23', occurredAt: '2026-01-02T10:30:00.000Z' },
  },
  {
    fileName: 'satispay.csv',
    slug: 'satispay',
    descriptionStripPattern: null,
    expectedHashes: [
      '494ae0ea38cfc38785d150ee30559d1175636cf7c10f9ac82e0af503f172c5a1',
      '3fdff687639af959a74fffdb671c9f214c58c031bfa8a0967fe3c4e8669d7c84',
      '494ae0ea38cfc38785d150ee30559d1175636cf7c10f9ac82e0af503f172c5a1',
    ],
    firstRow: { amount: '-3.50', occurredAt: '2026-01-02T10:30:00.000Z' },
  },
  {
    fileName: 'intesa-sp.csv',
    slug: 'intesa-sp',
    descriptionStripPattern: null,
    expectedHashes: [
      'ed47b86ed72ceb9f421a3bfd796cb8a99631ef2f0c847da2bd9c08f60058a6a7',
      '5b0ed2c6b158bac04f99bc943c5b1108427d8e74735e839cdd7859352e02617b',
      'ed47b86ed72ceb9f421a3bfd796cb8a99631ef2f0c847da2bd9c08f60058a6a7',
    ],
    firstRow: { amount: '-12.34', occurredAt: '2026-01-02T00:00:00.000Z' },
  },
  {
    fileName: 'intesa-sp-carta-credito.csv',
    slug: 'intesa-sp-carta-credito',
    descriptionStripPattern: null,
    expectedHashes: [
      'bd73ec7a89203c32ce5b31aa047a60cdd9faf47372ffcbd494e146cc880f1877',
      '33f756a6690c916dfdab22fa0bb561c63399896c423d1bd9ec3bd0f2b377c2b5',
      'bd73ec7a89203c32ce5b31aa047a60cdd9faf47372ffcbd494e146cc880f1877',
    ],
    // multiplyBy: -1 — Addebiti "12,34" → -12.34
    firstRow: { amount: '-12.34', occurredAt: '2026-01-02T00:00:00.000Z' },
  },
  {
    fileName: 'revolut.csv',
    slug: 'revolut',
    descriptionStripPattern: null,
    expectedHashes: [
      'b66d41fb78fd4e41e63ac3495b22dda82603b9892b625c9d765ceebee170c95b',
      'cd6290bb5260f746d96ed9d81a92bf32ba5dbc09136629eb553e453b8c5a0424',
      'b66d41fb78fd4e41e63ac3495b22dda82603b9892b625c9d765ceebee170c95b',
    ],
    firstRow: { amount: '-12.34', occurredAt: '2026-01-02T10:30:00.000Z' },
  },
  {
    fileName: 'fineco.csv',
    slug: 'fineco',
    // Mirrors today's production Fineco platform row (seed-extras STEP set-fineco-description-strip-pattern)
    descriptionStripPattern: '\\s+Carta N\\..*$',
    expectedHashes: [
      '59d77d0f318078bf2cbfbc0b22ad008817500b27da035a3a4df442052dde5884',
      '410b61ca3abf242b0030532d16cf3959f96d1d0a99361c127e2d2af76128aeba',
      '59d77d0f318078bf2cbfbc0b22ad008817500b27da035a3a4df442052dde5884',
    ],
    // amountType: separate — Uscite "12.34" → -12.34; Entrate "2500.00" → 2500.00
    firstRow: { amount: '-12.34', occurredAt: '2026-01-02T00:00:00.000Z' },
  },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('import transactionHash contract (regression baseline)', () => {
  it.each(FIXTURES)(
    '$fileName: all row hashes match static literals',
    async ({ fileName, slug, descriptionStripPattern, expectedHashes, firstRow }) => {
      const bytes = readFileSync(fixturePath(fileName))
      const parsed = await parseImportFile(bytes, { fileName })
      const config = buildConfig(slug, descriptionStripPattern)

      const hashes = parsed.rows.map((row, idx) => {
        const result = normalizeTransactionRow(row, config, { userId: FIXED_USER_ID, rowIndex: idx + 1 })
        return result.transactionHash
      })

      // Non-vacuous: at least one non-null hash per fixture
      expect(hashes.filter((h) => h !== null).length).toBeGreaterThanOrEqual(1)

      // Primary pin: every hash matches its literal exactly
      expect(hashes).toEqual(expectedHashes)

      // Secondary pins on first row: catch sign/multiplier/date drift
      const firstResult = normalizeTransactionRow(parsed.rows[0]!, config, {
        userId: FIXED_USER_ID,
        rowIndex: 1,
      })
      expect(firstResult.amount).toBe(firstRow.amount)
      expect(firstResult.occurredAt?.toISOString()).toBe(firstRow.occurredAt)
    },
  )
})
