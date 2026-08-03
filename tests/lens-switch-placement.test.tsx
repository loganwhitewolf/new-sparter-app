import { readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * True only for a path that exists AND is a regular file. `existsSync` alone is not enough: a
 * module specifier like `@/lib/db` names a DIRECTORY (`lib/db/`), which exists, so accepting it
 * would hand a directory to readFileSync and throw EISDIR mid-walk. Guarding on isFile() makes the
 * resolver skip the bare-directory candidate and fall through to `index.ts`/`index.tsx`.
 */
function isFile(candidate: string): boolean {
  try {
    return statSync(resolve(process.cwd(), candidate)).isFile()
  } catch {
    return false
  }
}

// Source-inspection test (not a rendered component tree): this repo's Node-only test env has
// no jsdom for a full RSC render, so D-12/RETIRE-03's "renders no LensSwitch" claim is verified
// by grepping the compiled-away source text instead — the established pattern noted in prior
// SUMMARYs (e.g. tests/dashboard-filters.test.ts's grep-style assertions).
function readSource(relativePath: string): string {
  return readFileSync(`${process.cwd()}/${relativePath}`, 'utf-8')
}

/**
 * Walk the import graph one level deep: for a given source file, extract its imported module
 * paths, resolve them to real files, and look for a `<LensSwitch` render inside them. This makes
 * the assertion identifier-agnostic — the realistic regression is not a page re-importing
 * `LensSwitch` by name, it is a page pulling in a *wrapper* component that renders the switch.
 * A single-file grep cannot see that; this can.
 *
 * `@/*` maps to the project root (`tsconfig.json` → `{"@/*": ["./*"]}`), NOT to `app/`. Getting
 * that wrong makes every import unresolvable, and because unresolvable imports are skipped the
 * whole walk then silently reports "clean" for every input — a vacuous pass. The
 * `resolvesTheImportGraph` positive-control test below exists to keep that failure mode dead: it
 * asserts the walk *does* find LensSwitch from the Overview page, so the negative assertions in
 * this file can only pass because the pages really are clean.
 */
function extractImportPaths(sourceText: string): string[] {
  // Matches the module specifier of any import/export-from, including multi-line import blocks.
  const importRegex = /from\s+['"]([^'"]+)['"]/g
  const paths: string[] = []
  let match

  while ((match = importRegex.exec(sourceText)) !== null) {
    const importPath = match[1]
    // First-party only: bare specifiers are node_modules and cannot render our LensSwitch.
    if (importPath.startsWith('.') || importPath.startsWith('@/')) {
      paths.push(importPath)
    }
  }

  return paths
}

function resolveImportPath(importPath: string, sourceDir: string): string | null {
  const base = importPath.startsWith('@/')
    ? importPath.slice('@/'.length)
    : join(sourceDir, importPath)

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ]

  for (const candidate of candidates) {
    if (isFile(candidate)) return candidate
  }

  return null
}

/**
 * Returns every one-hop import of `sourceFile` whose own source renders `<LensSwitch`.
 * `unresolved` is reported so a silently-empty walk is distinguishable from a genuinely clean one.
 */
function lensSwitchRenderingImportsOf(sourceFile: string): {
  offenders: string[]
  resolved: number
  unresolved: string[]
} {
  const sourceDir = sourceFile.split('/').slice(0, -1).join('/')
  const importPaths = extractImportPaths(readSource(sourceFile))

  const offenders: string[] = []
  const unresolved: string[] = []
  let resolved = 0

  for (const importPath of importPaths) {
    const resolvedPath = resolveImportPath(importPath, sourceDir)

    if (!resolvedPath) {
      unresolved.push(importPath)
      continue
    }

    resolved++

    if (readSource(resolvedPath).includes('<LensSwitch')) {
      offenders.push(`${importPath} (file: ${resolvedPath})`)
    }
  }

  return { offenders, resolved, unresolved }
}

describe('LensSwitch render-site placement (D-12, RETIRE-03)', () => {
  // POSITIVE CONTROL — must come first. Proves the import-graph walk actually resolves modules
  // and actually detects a transitively-rendered LensSwitch. Without this, a resolution bug would
  // make every negative assertion below pass for free. The Overview page does not render
  // <LensSwitch itself: it renders <OverviewHeader, which renders the switch. So a walk that finds
  // it here is a walk that would find it on Categories or Tags too.
  it('resolvesTheImportGraph: the walk detects LensSwitch one hop away on Overview, where it legitimately lives', () => {
    const overviewPage = 'app/(app)/dashboard/overview/page.tsx'

    expect(readSource(overviewPage)).not.toContain('<LensSwitch')

    const { offenders, resolved, unresolved } = lensSwitchRenderingImportsOf(overviewPage)

    expect(resolved).toBeGreaterThan(0)
    expect(unresolved).toEqual([])
    expect(offenders.join('; ')).toContain('overview-header')
  })

  it('Categories list page renders no LensSwitch, directly or through an imported component, and resolves no ledgerRowSource from the URL', () => {
    const page = 'app/(app)/dashboard/categories/page.tsx'
    const source = readSource(page)

    expect(source).not.toContain('<LensSwitch')
    expect(source).not.toContain('resolveLedgerRowSource(')

    const { offenders, resolved, unresolved } = lensSwitchRenderingImportsOf(page)

    expect(resolved).toBeGreaterThan(0)
    expect(unresolved).toEqual([])
    expect(offenders).toEqual([])
  })

  it('Categories detail page renders no LensSwitch, directly or through an imported component, and resolves no ledgerRowSource from the URL', () => {
    const page = 'app/(app)/dashboard/categories/[id]/page.tsx'
    const source = readSource(page)

    expect(source).not.toContain('<LensSwitch')
    expect(source).not.toContain('resolveLedgerRowSource(')

    const { offenders, resolved, unresolved } = lensSwitchRenderingImportsOf(page)

    expect(resolved).toBeGreaterThan(0)
    expect(unresolved).toEqual([])
    expect(offenders).toEqual([])
  })

  it('Tags page renders no LensSwitch, directly or through an imported component (already compliant, LSD-05 — verify only, no edit)', () => {
    const page = 'app/(app)/dashboard/tags/page.tsx'

    expect(readSource(page)).not.toContain('<LensSwitch')

    const { offenders, resolved, unresolved } = lensSwitchRenderingImportsOf(page)

    expect(resolved).toBeGreaterThan(0)
    expect(unresolved).toEqual([])
    expect(offenders).toEqual([])
  })

  it('Overview header remains the sole LensSwitch render site', () => {
    const source = readSource('components/dashboard/overview/overview-header.tsx')
    expect(source).toContain('<LensSwitch')
  })
})
