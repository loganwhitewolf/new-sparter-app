import { verifySession } from '@/lib/dal/auth'
import { getUserProfile } from '@/lib/dal/users'
import { ProfileForm } from '@/components/profile/profile-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConnectedAccountsCard } from '@/components/profile/connected-accounts-card'
import type { Provider } from '@/components/auth/social-provider-buttons'

export const metadata = {
  title: 'Profilo — Sparter',
}

interface ProfileSettingsPageProps {
  searchParams: Promise<{ linked?: string; error?: string }>
}

export default async function ProfileSettingsPage({
  searchParams,
}: ProfileSettingsPageProps) {
  const params = await searchParams
  const session = await verifySession()
  const profile = await getUserProfile(session.userId)

  const email = profile.email ?? session.email
  const subscriptionLabel =
    profile.subscriptionPlan === 'pro'
      ? 'Pro'
      : profile.subscriptionPlan === 'basic'
        ? 'Basic'
        : 'Free'
  const roleLabel = profile.role === 'admin' ? 'Amministratore' : 'Utente'

  // D-07: configured providers are derived from server-only env vars.
  // Do NOT introduce NEXT_PUBLIC_* equivalents.
  const configuredProviders: Provider[] = [
    ...(process.env.GOOGLE_CLIENT_ID ? (['google'] as Provider[]) : []),
    ...(process.env.GITHUB_CLIENT_ID ? (['github'] as Provider[]) : []),
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profilo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestisci le tue informazioni personali.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Email</span>
            <span
              id="account-email"
              className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
              aria-label="Email (sola lettura)"
            >
              {email}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Piano</span>
              <span
                id="account-plan"
                className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
                aria-label="Piano (sola lettura)"
              >
                {subscriptionLabel}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Ruolo</span>
              <span
                id="account-role"
                className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
                aria-label="Ruolo (sola lettura)"
              >
                {roleLabel}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <ProfileForm profile={profile} />

      <ConnectedAccountsCard
        configuredProviders={configuredProviders}
        initialLinked={params.linked}
        initialError={params.error}
      />
    </div>
  )
}
