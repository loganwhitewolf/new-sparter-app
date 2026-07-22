import { redirect } from 'next/navigation'
import { APP_ROUTES } from '@/lib/routes'

export const metadata = { robots: 'noindex, nofollow' }

export default function SettingsRedirect() {
  redirect(APP_ROUTES.profileSettings)
}
