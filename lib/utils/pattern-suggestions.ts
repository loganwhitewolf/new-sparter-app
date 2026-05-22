import Decimal from 'decimal.js'

export interface PatternDetectorRow {
  description: string
  normalizedDescription: string
  amount: string | null
  valid: boolean
  covered: boolean
}

export interface CoveragePattern {
  pattern: string
  amountSign: 'positive' | 'negative' | 'any'
}

export interface PatternSuggestion {
  pattern: string
  matchCount: number
  detectedAmountSign: 'positive' | 'negative' | 'any'
  sampleDescriptions: string[]
}

export function detectPatternSuggestions(
  rows: PatternDetectorRow[],
  coveragePatterns: CoveragePattern[],
): PatternSuggestion[] {
  // TODO Task 2: implement
  void rows
  void coveragePatterns
  void Decimal
  return []
}
