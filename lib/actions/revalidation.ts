import 'server-only'

import { revalidatePath } from 'next/cache'
import { APP_ROUTES } from '@/lib/routes'

export function revalidateCategorizationSurfaces() {
  revalidatePath(APP_ROUTES.expenses)
  revalidatePath(APP_ROUTES.transactions)
  revalidatePath(APP_ROUTES.dashboard)
  revalidatePath(APP_ROUTES.patternSettings)
  revalidatePath(APP_ROUTES.categorySettings)
}
