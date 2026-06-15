/**
 * One-off overlap audit for systemCategorizationPatterns.
 * Run: yarn tsx scripts/audit-pattern-overlaps.ts
 */
import { applyTier1Regex } from '../lib/services/categorization-match'
import { systemCategorizationPatterns } from './seed-patterns-data'

type Row = (typeof systemCategorizationPatterns)[number] & { index: number }

// Use the production matcher (single source of truth) instead of re-implementing the
// strip+regex rule, so this audit can never drift from how coverage actually behaves.
function matches(pattern: string, description: string): boolean {
  return (
    applyTier1Regex(description, '0', [
      { id: 0, userId: null, pattern, subCategoryId: 0, confidence: '1', priority: 0 },
    ]) !== null
  )
}

/** Pull \b...\b and other literal chunks useful as witness seeds. */
function literalSeeds(pattern: string): string[] {
  const seeds = new Set<string>()
  const wordBoundary = /\\b([^\\]+?)\\b/g
  let m: RegExpExecArray | null
  while ((m = wordBoundary.exec(pattern)) !== null) {
    const raw = m[1]
      .replace(/\(\?:/g, '')
      .replace(/[?*+^$|()[\]{}]/g, ' ')
      .trim()
    for (const part of raw.split(/[|\\]/)) {
      const cleaned = part
        .replace(/\\s\*/g, ' ')
        .replace(/\\s/g, ' ')
        .replace(/\\\./g, '.')
        .replace(/\\\+/g, '+')
        .replace(/\\\?/g, '')
        .replace(/[.*+?^${}()|[\]\\]/g, '')
        .trim()
      if (cleaned.length >= 2 && !/^\[/.test(part)) seeds.add(cleaned)
    }
  }

  // Anchored literals without word boundaries
  for (const lit of ['bonifico', 'canone mensile']) {
    if (pattern.includes(lit)) seeds.add(lit)
  }

  return [...seeds]
}

function witnessCandidates(a: string, b: string): string[] {
  const seedsA = literalSeeds(a)
  const seedsB = literalSeeds(b)
  const shared = seedsA.filter((s) =>
    seedsB.some((t) => s.toLowerCase() === t.toLowerCase() || s.includes(t) || t.includes(s)),
  )

  const candidates = new Set<string>()
  const pads = [
    (s: string) => s,
    (s: string) => `PAGAMENTO ${s} MILANO IT`,
    (s: string) => `POS ${s} CARTA 114`,
    (s: string) => `${s} SPA ITALIA`,
    (s: string) => `Beneficiario: ${s} Causale: test`,
  ]

  for (const seed of [...seedsA, ...seedsB, ...shared]) {
    for (const pad of pads) candidates.add(pad(seed))
  }

  // Known compound witnesses for risky pairs
  candidates.add('eni plenitude energia')
  candidates.add('eni stazione di servizio')
  candidates.add('gastronomia milano')
  candidates.add('coop voce mensile')
  candidates.add('poste mobile ricarica')
  candidates.add('padel club gpadel')
  candidates.add('rosticceria pizza al taglio')
  candidates.add('pizza ristorante milano')

  return [...candidates]
}

function productionWinner(
  description: string,
  rows: Row[],
): { winner: Row; alsoMatched: Row[] } | null {
  const matched = rows.filter((r) => matches(r.pattern, description))
  if (matched.length === 0) return null

  const sorted = [...matched].sort((x, y) => {
    if (x.priority !== y.priority) return x.priority - y.priority
    return x.index - y.index
  })

  return { winner: sorted[0]!, alsoMatched: sorted.slice(1) }
}

const rows: Row[] = systemCategorizationPatterns.map((r, index) => ({ ...r, index }))

type Conflict = {
  witness: string
  winner: { description: string; slug: string; priority: number; pattern: string }
  losers: Array<{ description: string; slug: string; priority: number; pattern: string }>
}

const conflicts: Conflict[] = []
const seenConflictKeys = new Set<string>()

for (let i = 0; i < rows.length; i++) {
  for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i]!
    const b = rows[j]!
    if (a.subCategorySlug === b.subCategorySlug) continue

    for (const witness of witnessCandidates(a.pattern, b.pattern)) {
      if (!matches(a.pattern, witness) || !matches(b.pattern, witness)) continue

      const result = productionWinner(witness, rows)
      if (!result || result.alsoMatched.length === 0) continue

      const loserSlugs = new Set(
        result.alsoMatched
          .filter((r) => r.subCategorySlug !== result.winner.subCategorySlug)
          .map((r) => r.subCategorySlug),
      )
      if (loserSlugs.size === 0) continue

      const key = `${witness}::${result.winner.subCategorySlug}::${[...loserSlugs].sort().join(',')}`
      if (seenConflictKeys.has(key)) continue
      seenConflictKeys.add(key)

      conflicts.push({
        witness,
        winner: {
          description: result.winner.description,
          slug: result.winner.subCategorySlug,
          priority: result.winner.priority,
          pattern: result.winner.pattern.slice(0, 80),
        },
        losers: result.alsoMatched
          .filter((r) => r.subCategorySlug !== result.winner.subCategorySlug)
          .map((r) => ({
            description: r.description,
            slug: r.subCategorySlug,
            priority: r.priority,
            pattern: r.pattern.slice(0, 80),
          })),
      })
    }
  }
}

// Token-level cross-pattern notes (different subcategory, shared token substring in pattern source)
const tokenNotes: Array<{ token: string; patterns: Array<{ slug: string; description: string }> }> = []
const tokens = new Map<string, Array<{ slug: string; description: string; pattern: string }>>()

for (const row of rows) {
  for (const token of literalSeeds(row.pattern)) {
    const key = token.toLowerCase()
    const bucket = tokens.get(key) ?? []
    bucket.push({ slug: row.subCategorySlug, description: row.description, pattern: row.pattern })
    tokens.set(key, bucket)
  }
}

for (const [token, hits] of tokens) {
  const slugs = new Set(hits.map((h) => h.slug))
  if (slugs.size < 2) continue
  tokenNotes.push({
    token,
    patterns: hits.map((h) => ({ slug: h.slug, description: h.description })),
  })
}

tokenNotes.sort((a, b) => b.patterns.length - a.patterns.length)

console.log(
  JSON.stringify(
    {
      patternCount: rows.length,
      regexConflicts: conflicts.length,
      conflicts: conflicts.sort((a, b) => a.winner.slug.localeCompare(b.winner.slug)),
      tokenCrossCategoryNotes: tokenNotes.slice(0, 25),
      tokenCrossCategoryCount: tokenNotes.length,
    },
    null,
    2,
  ),
)
