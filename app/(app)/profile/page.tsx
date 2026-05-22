import { redirect } from 'next/navigation'
import { APP_ROUTES } from '@/lib/routes'

export const metadata = { robots: 'noindex, nofollow' }

export default function ProfileRedirect() {
  redirect(APP_ROUTES.profileSettings)
}
