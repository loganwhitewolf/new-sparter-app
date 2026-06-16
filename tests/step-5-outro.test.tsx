import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

const { Step5Outro } = await import('@/app/(app)/onboarding/_components/step-5-outro')
const source = readFileSync('app/(app)/onboarding/_components/step-5-outro.tsx', 'utf8')

function renderOutro() {
  return renderToStaticMarkup(<Step5Outro />)
}

describe('Step5Outro (R-OB-08)', () => {
  it("R-OB-08 renders the Italian welcome heading 'Benvenuto in Sparter!'", () => {
    const html = renderOutro()

    expect(html).toContain('Benvenuto in Sparter!')
  })

  it("R-OB-08 renders a link to /dashboard with text 'Vai alla dashboard'", () => {
    const html = renderOutro()

    expect(html).toContain('href="/dashboard"')
    expect(html).toContain('Vai alla dashboard')
  })

  it("R-OB-08 renders a link to /settings/categories with text 'Personalizza le categorie'", () => {
    const html = renderOutro()

    expect(html).toContain('href="/settings/categories"')
    expect(html).toContain('Personalizza le categorie')
  })

  it('uses hard navigation for settings categories so the app shell sidebar is restored', () => {
    expect(source).not.toContain("from 'next/link'")
    expect(source).toContain('<a href={APP_ROUTES.categorySettings}>')
  })

  it('R-OB-08 does not append a firstRun query parameter to either CTA', () => {
    const html = renderOutro()

    expect(html).not.toContain('firstRun')
  })

  it('uses only design-system tokens for background and text colors', () => {
    const html = renderOutro()

    expect(html).not.toMatch(/bg-green-|text-green-|from-green-|to-green-|bg-red-|text-red-/)
  })
})
