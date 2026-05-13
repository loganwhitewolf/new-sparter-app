import { redirect } from 'next/navigation'
import { APP_ROUTES } from '@/lib/routes'

export default function SettingsPage() {
  redirect(APP_ROUTES.categorySettings)
}
