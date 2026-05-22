import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

// Mock auth-client before importing the component under test.
// The component calls authClient.listAccounts() on mount; we never fire real requests in unit tests.
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    listAccounts: vi.fn().mockResolvedValue({ data: [], error: null }),
    linkSocial: vi.fn(),
    unlinkAccount: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const { ConnectedAccountsCard } = await import(
  '@/components/profile/connected-accounts-card'
)

describe('ConnectedAccountsCard render (LINK-04)', () => {
  it('renders empty state when configuredProviders is empty (D-08)', () => {
    const html = renderToStaticMarkup(
      <ConnectedAccountsCard configuredProviders={[]} />
    )
    expect(html).toContain('Account collegati')
    expect(html).toContain('Nessun provider social configurato.')
  })

  it('renders Google row when configuredProviders=[google]', () => {
    const html = renderToStaticMarkup(
      <ConnectedAccountsCard configuredProviders={['google']} />
    )
    expect(html).toContain('Account collegati')
    expect(html).toContain('Google')
    expect(html).not.toContain('GitHub')
  })

  it('renders GitHub row when configuredProviders=[github]', () => {
    const html = renderToStaticMarkup(
      <ConnectedAccountsCard configuredProviders={['github']} />
    )
    expect(html).toContain('Account collegati')
    expect(html).toContain('GitHub')
    expect(html).not.toContain('Google')
  })

  it('renders Google before GitHub when both are configured', () => {
    const html = renderToStaticMarkup(
      <ConnectedAccountsCard configuredProviders={['google', 'github']} />
    )
    const googleIdx = html.indexOf('Google')
    const githubIdx = html.indexOf('GitHub')
    expect(googleIdx).toBeGreaterThanOrEqual(0)
    expect(githubIdx).toBeGreaterThanOrEqual(0)
    expect(googleIdx).toBeLessThan(githubIdx)
  })
})

describe('ConnectedAccountsCard initial state (LINK-04)', () => {
  it('shows Non collegato label for unlinked providers on initial render', () => {
    const html = renderToStaticMarkup(
      <ConnectedAccountsCard configuredProviders={['google', 'github']} />
    )
    // useEffect with mocked listAccounts hasn't resolved during static render
    expect(html).toContain('Non collegato')
  })

  it('renders an error alert when initialError=email_doesn%27t_match (D-12, Pitfall 1)', () => {
    const html = renderToStaticMarkup(
      <ConnectedAccountsCard
        configuredProviders={['google']}
        initialError="email_doesn%27t_match"
      />
    )
    // React 19 renderToStaticMarkup encodes apostrophes as &#x27; in text content.
    // We check for the HTML-encoded form which is what the DOM actually contains.
    expect(html).toContain(
      "L&#x27;email del provider non corrisponde all&#x27;email del tuo account Sparter."
    )
  })

  it('falls back to generic message for unknown initialError', () => {
    const html = renderToStaticMarkup(
      <ConnectedAccountsCard
        configuredProviders={['google']}
        initialError="totally_unknown"
      />
    )
    expect(html).toContain('Collegamento non riuscito. Riprova.')
  })
})

describe('ConnectedAccountsCard unlink guard (LINK-03)', () => {
  // Note: these specs exercise the canUnlink helper indirectly. Because the
  // initial async listAccounts resolves to [] in the default mock, both
  // providers appear unlinked. To assert the guard, we use
  // @testing-library/react render + waitFor to flush the effect when the mock
  // returns a populated account list. Use the async pattern below.
  it.todo('canUnlink guard — implement with @testing-library/react when jsdom is added to devDependencies')
})
