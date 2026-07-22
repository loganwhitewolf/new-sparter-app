import 'server-only'

import { refresh, revalidatePath } from 'next/cache'
import { APP_ROUTES } from '@/lib/routes'

export function revalidateCategorizationSurfaces() {
  revalidatePath(APP_ROUTES.expenses)
  revalidatePath(APP_ROUTES.transactions)
  revalidatePath(APP_ROUTES.dashboard)
  revalidatePath(APP_ROUTES.categorySettings)
  revalidatePath(APP_ROUTES.patterns)
  // Suggestions page reads expense.subCategoryId; promoted patterns clear suggestions when applied.
  revalidatePath(APP_ROUTES.import, 'layout')
  refresh()
}
