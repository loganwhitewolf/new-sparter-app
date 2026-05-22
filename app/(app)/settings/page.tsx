import { SettingsHub } from '@/components/settings/settings-hub'

export const metadata = {
  title: 'Impostazioni — Sparter',
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Impostazioni</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestisci il tuo profilo e le impostazioni dell&apos;applicazione.
        </p>
      </div>
      <SettingsHub />
    </div>
  )
}
