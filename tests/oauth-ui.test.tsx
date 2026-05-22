import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

// Mock auth-client before importing the component under test.
// The component calls authClient.signIn.social() on click; we never fire that in unit tests.
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: {
      social: vi.fn(),
    },
  },
}))

const { SocialProviderButtons, getOAuthErrorMessage } = await import(
  '@/components/auth/social-provider-buttons'
)

describe('SocialProviderButtons (OAUTH-05, D-06)', () => {
  it('renders nothing when providers array is empty', () => {
    const html = renderToStaticMarkup(<SocialProviderButtons providers={[]} />)
    expect(html).toBe('')
  })

  it('renders only the Google button when providers=[google]', () => {
    const html = renderToStaticMarkup(<SocialProviderButtons providers={['google']} />)
    expect(html).toContain('Continua con Google')
    expect(html).not.toContain('Continua con GitHub')
  })

  it('renders only the GitHub button when providers=[github]', () => {
    const html = renderToStaticMarkup(<SocialProviderButtons providers={['github']} />)
    expect(html).toContain('Continua con GitHub')
    expect(html).not.toContain('Continua con Google')
  })

  it('renders Google before GitHub when both providers present (D-03)', () => {
    const html = renderToStaticMarkup(
      <SocialProviderButtons providers={['google', 'github']} />,
    )
    const googleIdx = html.indexOf('Continua con Google')
    const githubIdx = html.indexOf('Continua con GitHub')
    expect(googleIdx).toBeGreaterThanOrEqual(0)
    expect(githubIdx).toBeGreaterThanOrEqual(0)
    expect(googleIdx).toBeLessThan(githubIdx)
  })
})

describe('getOAuthErrorMessage (D-07, D-08)', () => {
  it('returns null for undefined', () => {
    expect(getOAuthErrorMessage(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(getOAuthErrorMessage('')).toBeNull()
  })

  it('maps OAuthCallbackError to the generic Italian message', () => {
    expect(getOAuthErrorMessage('OAuthCallbackError')).toBe(
      'Accesso con social non riuscito. Riprova.',
    )
  })

  it('maps access_denied to its dedicated Italian message', () => {
    expect(getOAuthErrorMessage('access_denied')).toBe(
      'Hai annullato il login. Riprova se vuoi continuare.',
    )
  })

  it('falls back to the generic Italian message for unknown codes', () => {
    expect(getOAuthErrorMessage('totally_unknown_xyz_code')).toBe(
      'Accesso con social non riuscito. Riprova.',
    )
  })
})
