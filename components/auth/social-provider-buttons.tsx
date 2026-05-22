'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

export type Provider = 'google' | 'github'

export interface SocialProviderButtonsProps {
  providers: Provider[]
  /**
   * Where Better Auth should redirect on OAuth failure.
   * Defaults to '/login?error=OAuthCallbackError'.
   * The register page should pass '/register?error=OAuthCallbackError' (D-07).
   */
  errorCallbackURL?: string
}

const DEFAULT_ERROR_URL = '/login?error=OAuthCallbackError'
const SUCCESS_CALLBACK_URL = '/dashboard'

/**
 * Italian message map for Better Auth OAuth error codes (D-08).
 * Codes verified from node_modules/better-auth/dist/api/routes/callback.mjs.
 * Provider-level codes (e.g. access_denied) are passed through as-is.
 */
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthCallbackError: 'Accesso con social non riuscito. Riprova.',
  access_denied: 'Hai annullato il login. Riprova se vuoi continuare.',
  invalid_code: 'Sessione scaduta. Riprova il login.',
  email_not_found: "Il provider non ha fornito un'email. Usa un altro metodo.",
  unable_to_get_user_info:
    'Impossibile recuperare i dati del profilo. Riprova.',
  state_mismatch: 'Sessione non valida. Riprova il login.',
  oauth_provider_not_found:
    'Provider non configurato. Contatta il supporto.',
}

const OAUTH_ERROR_FALLBACK = 'Accesso con social non riuscito. Riprova.'

/**
 * Translate a Better Auth OAuth error code from `?error=...` into an Italian
 * user-facing message (D-08). Returns null when there is no error to display.
 */
export function getOAuthErrorMessage(code: string | undefined): string | null {
  if (!code) return null
  return OAUTH_ERROR_MESSAGES[code] ?? OAUTH_ERROR_FALLBACK
}

/**
 * Inline GitHub mark icon (lucide-react@1.14.0 does not export Github).
 * Using the official GitHub invertocat SVG path.
 */
function GithubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mr-2 h-4 w-4"
      aria-hidden
      focusable="false"
      fill="currentColor"
    >
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

/**
 * Inline Google brand icon (no Lucide equivalent — see RESEARCH.md Pattern 5).
 * Multicolor SVG using Google's official brand colors.
 */
function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mr-2 h-4 w-4"
      aria-hidden
      focusable="false"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

/**
 * Renders "Continua con Google" / "Continua con GitHub" buttons (D-04) above
 * the email/password form (D-01). Order is Google-first (D-03). Returns null
 * when no providers are active (D-06) so the parent does not render an empty
 * section or stray divider.
 */
export function SocialProviderButtons({
  providers,
  errorCallbackURL,
}: SocialProviderButtonsProps) {
  const [pending, setPending] = useState<Provider | null>(null)

  if (providers.length === 0) return null

  async function handleSignIn(provider: Provider) {
    setPending(provider)
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: SUCCESS_CALLBACK_URL,
        errorCallbackURL: errorCallbackURL ?? DEFAULT_ERROR_URL,
      })
    } finally {
      // Safety reset; will not execute on successful browser redirect.
      setPending(null)
    }
  }

  const showGoogle = providers.includes('google')
  const showGithub = providers.includes('github')
  const anyPending = pending !== null

  return (
    <div className="flex flex-col gap-2">
      {showGoogle && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => handleSignIn('google')}
          disabled={anyPending}
        >
          {pending === 'google' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          Continua con Google
        </Button>
      )}
      {showGithub && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => handleSignIn('github')}
          disabled={anyPending}
        >
          {pending === 'github' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GithubIcon />
          )}
          Continua con GitHub
        </Button>
      )}
    </div>
  )
}
