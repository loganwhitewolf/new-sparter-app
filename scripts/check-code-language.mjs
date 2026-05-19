#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const ignoredDirectories = new Set([
  '.claude',
  '.git',
  '.gsd',
  '.next',
  '.planning',
  'coverage',
  'node_modules',
  'test-results',
])

const textExtensions = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.md',
  '.mdx',
])

const routeAllowlist = new Set(['lib/routes.ts', 'next.config.ts', 'scripts/check-code-language.mjs'])
const activeDocs = new Set(['AGENTS.md', 'CLAUDE.md'])
const sourceRoots = ['app', 'components', 'lib', 'tests', 'drizzle', 'scripts']

const forbiddenLegacyRouteFragments = [
  '/spese',
  '/transazioni',
  '/impostazioni',
]

const forbiddenIdentifiers = [
  'SpesePage',
  'TransazioniPage',
]

const italianDeveloperTerms = [
  'categoria',
  'categorie',
  'sottocategoria',
  'sottocategorie',
  'transazione',
  'transazioni',
  'spesa',
  'spese',
  'utente',
  'utenti',
  'piano',
  'regole',
  'nessuna',
  'nessun',
  'seleziona',
  'conferma',
  'modifica',
]

function walk(directory) {
  const entries = []

  for (const name of readdirSync(directory)) {
    if (ignoredDirectories.has(name)) continue

    const absolutePath = path.join(directory, name)
    const relativePath = path.relative(root, absolutePath)
    const stat = statSync(absolutePath)

    if (stat.isDirectory()) {
      entries.push(...walk(absolutePath))
    } else if (textExtensions.has(path.extname(name))) {
      entries.push(relativePath)
    }
  }

  return entries
}

function isSourceFile(filePath) {
  return sourceRoots.some((sourceRoot) => filePath === sourceRoot || filePath.startsWith(`${sourceRoot}/`))
}

function isDomainFixture(filePath) {
  return filePath === 'scripts/seed.ts' || filePath === 'scripts/seed-data.ts' || filePath.startsWith('docs/init/')
}

function lineHasComment(line) {
  const trimmed = line.trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

function containsItalianTerm(line) {
  const lower = line.toLowerCase()
  return italianDeveloperTerms.some((term) => new RegExp(`\\b${term}\\b`, 'i').test(lower))
}

const failures = []
const files = walk(root)

for (const filePath of files) {
  const text = readFileSync(filePath, 'utf8')
  const lines = text.split('\n')

  if (!routeAllowlist.has(filePath)) {
    for (const fragment of forbiddenLegacyRouteFragments) {
      if (text.includes(fragment)) {
        failures.push(`${filePath}: contains legacy localized route fragment ${fragment}`)
      }
    }
  }

  if (!routeAllowlist.has(filePath)) {
    for (const identifier of forbiddenIdentifiers) {
      if (text.includes(identifier)) {
        failures.push(`${filePath}: contains non-English identifier ${identifier}`)
      }
    }
  }

  if ((isSourceFile(filePath) || activeDocs.has(filePath)) && !isDomainFixture(filePath)) {
    lines.forEach((line, index) => {
      if (lineHasComment(line) && (/[àèéìòù]/i.test(line) || containsItalianTerm(line))) {
        failures.push(`${filePath}:${index + 1}: developer-facing comment should be English`)
      }
    })
  }
}

if (failures.length > 0) {
  console.error('English code convention check failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('English code convention check passed.')
