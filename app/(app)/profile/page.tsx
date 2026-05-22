import { redirect } from 'next/navigation'
import { APP_ROUTES } from '@/lib/routes'

export default function ProfileRedirect() {
  redirect(APP_ROUTES.profileSettings)
}
