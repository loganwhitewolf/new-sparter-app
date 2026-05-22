'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { authClient } from '@/lib/auth-client'
import { APP_ROUTES } from '@/lib/routes'
import type { Provider } from '@/components/auth/social-provider-buttons'

// ---------- Constants ----------

const PROVIDER_LABELS = {
  google: 'Google',
  github: 'GitHub',
} satisfies Record<Provider, string>

// Stable display order — Google first (matches Phase 31 D-03 precedent)
const PROVIDER_ORDER: Provider[] = ['google', 'github']

const LAST_METHOD_TOOLTIP = "Non puoi scollegare l'unico metodo di accesso."
const UNLINK_SUCCESS_TOAST = 'Provider scollegato.'
const UNLINK_ERROR_TOAST = 'Errore durante la disconnessione.'
const EMPTY_STATE_TEXT = 'Nessun provider social configurato.'

// Italian error-message map for link callback codes (D-12)
// VERIFIED: better-auth/dist/api/routes/callback.mjs lines 105-128
const LINK_ERROR_MESSAGES: Record<string, string> = {
  "email_doesn't_match":
    "L'email del provider non corrisponde all'email del tuo account Sparter.",
  account_already_linked_to_different_user:
    'Questo account social è già collegato a un altro utente.',
  unable_to_link_account: "Impossibile collegare l'account. Riprova.",
  OAuthCallbackError: 'Collegamento non riuscito. Riprova.',
}
const LINK_ERROR_FALLBACK = 'Collegamento non riuscito. Riprova.'

function decodeAndMapError(raw: string | undefined): string | null {
  if (!raw) return null
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    decoded = raw
  }
  return LINK_ERROR_MESSAGES[decoded] ?? LINK_ERROR_FALLBACK
}

// ---------- Inline brand icons (reuse SVGs from social-provider-buttons.tsx) ----------

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden focusable="false">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden focusable="false" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

function ProviderIcon({ provider }: { provider: Provider }) {
  return provider === 'google' ? <GoogleIcon /> : <GithubIcon />
}

// ---------- Types ----------

type LinkedAccount = { id: string; providerId: string }

export interface ConnectedAccountsCardProps {
  configuredProviders: Provider[]
  initialLinked?: string
  initialError?: string
}

// ---------- Component ----------

export function ConnectedAccountsCard({
  configuredProviders,
  initialLinked,
  initialError,
}: ConnectedAccountsCardProps) {
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [pendingLink, setPendingLink] = useState<Provider | null>(null)
  const [pendingUnlink, setPendingUnlink] = useState<Provider | null>(null)
  const [unlinkDialog, setUnlinkDialog] = useState<Provider | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(
    decodeAndMapError(initialError),
  )

  async function refreshAccounts() {
    setLoadingAccounts(true)
    try {
      const result = await authClient.listAccounts()
      setLinkedAccounts((result?.data as LinkedAccount[] | null) ?? [])
    } catch {
      setLinkedAccounts([])
    } finally {
      setLoadingAccounts(false)
    }
  }

  // Initial mount fetch.
  useEffect(() => {
    void refreshAccounts()
  }, [])

  // Pitfall 2: after a successful link return, session cookie / account row may
  // not be visible yet. Delay-refresh once + show success toast.
  useEffect(() => {
    if (!initialLinked) return
    if (!PROVIDER_ORDER.includes(initialLinked as Provider)) return
    const provider = initialLinked as Provider
    const label = PROVIDER_LABELS[provider]
    toast.success(`${label} collegato.`)
    const t = setTimeout(() => void refreshAccounts(), 400)
    return () => clearTimeout(t)
  }, [initialLinked])

  const linkedProviders = useMemo(
    () => new Set(linkedAccounts.map((a) => a.providerId)),
    [linkedAccounts],
  )

  function canUnlink(provider: Provider): boolean {
    // D-14 / D-16: a valid remaining method is either a credential account
    // OR another linked social provider that is not the one being unlinked.
    const hasCredential = linkedAccounts.some((a) => a.providerId === 'credential')
    const otherSocial = linkedAccounts.some(
      (a) => a.providerId !== 'credential' && a.providerId !== provider,
    )
    return hasCredential || otherSocial
  }

  async function handleLink(provider: Provider) {
    setPendingLink(provider)
    setErrorMessage(null)
    try {
      await authClient.linkSocial({
        provider,
        callbackURL: `${APP_ROUTES.profileSettings}?linked=${provider}`,
        errorCallbackURL: APP_ROUTES.profileSettings,
      })
    } catch {
      setPendingLink(null)
      toast.error(LINK_ERROR_FALLBACK)
    }
    // Note: successful linkSocial triggers a browser redirect; pendingLink
    // reset on the post-redirect mount.
  }

  async function handleUnlink(provider: Provider) {
    setPendingUnlink(provider)
    setUnlinkDialog(null)
    try {
      const result = await authClient.unlinkAccount({ providerId: provider })
      if (result?.error) {
        toast.error(UNLINK_ERROR_TOAST)
        return
      }
      await refreshAccounts()
      toast.success(UNLINK_SUCCESS_TOAST)
    } catch {
      toast.error(UNLINK_ERROR_TOAST)
    } finally {
      setPendingUnlink(null)
    }
  }

  // D-08 empty state — render before the provider loop.
  if (configuredProviders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account collegati</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{EMPTY_STATE_TEXT}</p>
        </CardContent>
      </Card>
    )
  }

  // Stable provider order: filter PROVIDER_ORDER by what's configured.
  const renderOrder = PROVIDER_ORDER.filter((p) => configuredProviders.includes(p))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account collegati</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {errorMessage && (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        <ul className="flex flex-col gap-2">
          {renderOrder.map((provider) => {
            const isLinked = linkedProviders.has(provider)
            const label = PROVIDER_LABELS[provider]
            const unlinkAllowed = canUnlink(provider)
            const linkInProgress = pendingLink === provider
            const unlinkInProgress = pendingUnlink === provider

            return (
              <li
                key={provider}
                className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <ProviderIcon provider={provider} />
                  <span className="text-sm font-medium">{label}</span>
                  <Badge variant={isLinked ? 'default' : 'secondary'}>
                    {isLinked ? 'Collegato' : 'Non collegato'}
                  </Badge>
                </div>
                {!isLinked && !loadingAccounts && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleLink(provider)}
                    disabled={linkInProgress || pendingLink !== null}
                  >
                    {linkInProgress ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Collega
                  </Button>
                )}
                {isLinked && (
                  <Dialog
                    open={unlinkDialog === provider}
                    onOpenChange={(open) => setUnlinkDialog(open ? provider : null)}
                  >
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!unlinkAllowed || unlinkInProgress}
                        title={!unlinkAllowed ? LAST_METHOD_TOOLTIP : undefined}
                      >
                        Scollega
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Scollegare {label}?</DialogTitle>
                        <DialogDescription>
                          Non potrai più accedere a Sparter tramite {label} fino a
                          quando non lo ricollegherai.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="ghost">
                            Annulla
                          </Button>
                        </DialogClose>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => handleUnlink(provider)}
                          disabled={unlinkInProgress}
                        >
                          {unlinkInProgress ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Conferma
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
