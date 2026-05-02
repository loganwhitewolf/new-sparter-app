'use server'
import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal/auth'
import { ProfileSchema, type ActionState } from '@/lib/validations/profile'
import { updateUserProfile } from '@/lib/dal/users'

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await verifySession()

  const parsed = ProfileSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    jobTitle: formData.get('jobTitle'),
    location: formData.get('location'),
    phone: formData.get('phone'),
    timezone: formData.get('timezone'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    const updated = await updateUserProfile(userId, parsed.data)
    if (!updated) {
      return { error: 'Profilo non trovato. Riprova tra qualche secondo.' }
    }
  } catch {
    return { error: 'Si è verificato un errore. Riprova tra qualche secondo.' }
  }

  revalidatePath('/profile')
  return { error: null }
}
