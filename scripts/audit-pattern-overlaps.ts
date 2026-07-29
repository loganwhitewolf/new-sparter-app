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

/** Bank boilerplate bait strings from grocery hardening brief §4.3. */
const BANK_BOILERPLATE_BAIT = [
  'Ben:',
  'Ins:',
  'Da:',
  'Iban:',
  'TransID:',
  'Cau:',
  'Carta N.',
  'Bonifico SEPA',
  'Bonifico Italia',
  'Rif.',
  'Op.',
] as const

/**
 * Common Italian/English words that read as merchant tokens but appear in unrelated bank
 * descriptors. A word boundary does not make these safe — they need disambiguating context
 * (see the consistency rule above the grocery pattern in seed-patterns-data.ts).
 */
const GENERIC_WORDS = [
  'super',
  'market',
  'mercato',
  'booking',
  'viaggi',
  'viaggio',
  'travel',
  'forno',
  'iper',
  'tigre',
  'simply',
  'penny',
  'prix',
  'coop',
  'agora',
  'sigma',
  'selex',
  'castoro',
  'centro',
  'servizi',
  'servizio',
  'italia',
  'point',
  'store',
  'shop',
  'group',
  'gruppo',
  'casa',
  'city',
  'club',
] as const

type RiskyAltFinding = {
  slug: string
  description: string
  alternative: string
  reasons: string[]
  baitHits?: string[]
  genericWords?: string[]
}

/**
 * True when the pattern is a single non-capturing group wrapping everything, i.e. the trailing
 * `)` actually closes the leading `(?:`. Guards against mis-stripping shapes like
 * `(?:a|b)|(?:c)`, where naive slicing would produce the unbalanced body `a|b)|(?:c`.
 */
function isSingleOuterGroup(pattern: string): boolean {
  if (!pattern.startsWith('(?:') || !pattern.endsWith(')')) return false
  let depth = 0
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '\\') {
      i++
      continue
    }
    if (pattern[i] === '(') depth++
    else if (pattern[i] === ')') {
      depth--
      // The leading group closed before the end → there is more than one top-level term.
      if (depth === 0) return i === pattern.length - 1
    }
  }
  return false
}

function splitTopLevelAlternatives(pattern: string): string[] {
  const body = isSingleOuterGroup(pattern) ? pattern.slice(3, -1) : pattern

  const alts: string[] = []
  let current = ''
  let depth = 0
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!
    if (ch === '\\') {
      current += ch + (body[i + 1] ?? '')
      i++
      continue
    }
    if (ch === '(') {
      depth++
      current += ch
      continue
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1)
      current += ch
      continue
    }
    if (ch === '|' && depth === 0) {
      if (current.trim()) alts.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) alts.push(current)
  return alts
}

/** Approximate the literal words an alternative requires, ignoring regex syntax. */
function literalWords(alt: string): string[] {
  return literalTextEstimate(alt)
    .split(/[^a-zàèéìòù&]+/i)
    .filter((word) => word.length > 0)
}

/**
 * A generic word is only risky when it stands alone: `\bsuper\b` matches "SUPER BOLLO AUTO",
 * while `\bpenny\s+market\b` carries its own disambiguating context.
 */
function standaloneGenericWords(alt: string): string[] {
  const words = literalWords(alt)
  if (words.length !== 1) return []
  const word = words[0]!.toLowerCase()
  return GENERIC_WORDS.some((generic) => generic === word) ? [word] : []
}

function literalTextEstimate(alt: string): string {
  // Approximate visible literal text by stripping common regex syntax. Whitespace is
  // preserved (collapsed) so callers can still tell one literal word from several.
  return alt
    .replace(/\\b/g, '')
    .replace(/\\s\+/g, ' ')
    .replace(/\\s\*/g, '')
    .replace(/\\s/g, ' ')
    .replace(/\\w\*/g, '')
    .replace(/\\[dDwWsS]/g, 'X')
    .replace(/\(\?:/g, '')
    .replace(/[()[\]{}|+*?^$]/g, '')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\')
    .replace(/\s+/g, ' ')
    .trim()
}

function literalLengthEstimate(alt: string): number {
  return literalTextEstimate(alt).replace(/\s+/g, '').length
}

function findRiskyAlternatives(rows: Row[]): RiskyAltFinding[] {
  const findings: RiskyAltFinding[] = []

  for (const row of rows) {
    for (const alt of splitTopLevelAlternatives(row.pattern)) {
      const reasons: string[] = []
      const baitHits: string[] = []

      const literalLength = literalLengthEstimate(alt)
      if (literalLength > 0 && literalLength <= 4) {
        reasons.push('short-literal-le-4')
      }
      // Skip on patterns that match substrings by design — the absent \b is the point there.
      if (
        !row.substringMatch &&
        !alt.includes('\\b') &&
        !alt.startsWith('^') &&
        !alt.endsWith('$')
      ) {
        reasons.push('missing-word-boundary')
      }
      if (/\.\*/.test(alt)) {
        reasons.push('unbounded-dot-star')
      }

      // A word boundary does not rescue a bare generic word — this is the check that would
      // have caught \bbooking\b / \bviaggi\b in the travel-agency pattern.
      const genericWords = standaloneGenericWords(alt)
      if (genericWords.length > 0) {
        reasons.push('standalone-generic-word')
      }

      const altPattern = `(?:${alt})`
      for (const bait of BANK_BOILERPLATE_BAIT) {
        if (matches(altPattern, bait)) {
          baitHits.push(bait)
        }
      }
      if (baitHits.length > 0) {
        reasons.push('bank-boilerplate-bait')
      }

      if (reasons.length === 0) continue

      findings.push({
        slug: row.subCategorySlug,
        description: row.description,
        alternative: alt,
        reasons,
        ...(baitHits.length > 0 ? { baitHits } : {}),
        ...(genericWords.length > 0 ? { genericWords } : {}),
      })
    }
  }

  return findings
}

const riskyAlternatives = findRiskyAlternatives(rows)

console.log(
  JSON.stringify(
    {
      patternCount: rows.length,
      regexConflicts: conflicts.length,
      conflicts: conflicts.sort((a, b) => a.winner.slug.localeCompare(b.winner.slug)),
      tokenCrossCategoryNotes: tokenNotes.slice(0, 25),
      tokenCrossCategoryCount: tokenNotes.length,
      riskyAlternatives: {
        count: riskyAlternatives.length,
        findings: riskyAlternatives,
      },
    },
    null,
    2,
  ),
)
