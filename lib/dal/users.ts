import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import type { ProfileValues } from '@/lib/validations/profile'

export type UserProfile = {
  // Editable profile fields
  firstName: string | null
  lastName: string | null
  jobTitle: string | null
  location: string | null
  phone: string | null
  timezone: string | null
  // Read-only account metadata
  email: string | null
  subscriptionPlan: 'free' | 'basic' | 'pro' | null
  role: 'user' | 'admin' | null
  updatedAt: Date | null
}

const EMPTY_PROFILE: UserProfile = {
  firstName: null,
  lastName: null,
  jobTitle: null,
  location: null,
  phone: null,
  timezone: null,
  email: null,
  subscriptionPlan: null,
  role: null,
  updatedAt: null,
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const rows = await db
    .select({
      firstName: user.firstName,
      lastName: user.lastName,
      jobTitle: user.jobTitle,
      location: user.location,
      phone: user.phone,
      timezone: user.timezone,
      email: user.email,
      subscriptionPlan: user.subscriptionPlan,
      role: user.role,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  return rows[0] ?? EMPTY_PROFILE
}

export async function updateUserProfile(
  userId: string,
  input: ProfileValues,
): Promise<UserProfile | null> {
  const rows = await db
    .update(user)
    .set({
      firstName: input.firstName,
      lastName: input.lastName,
      jobTitle: input.jobTitle,
      location: input.location,
      phone: input.phone,
      timezone: input.timezone,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))
    .returning({
      firstName: user.firstName,
      lastName: user.lastName,
      jobTitle: user.jobTitle,
      location: user.location,
      phone: user.phone,
      timezone: user.timezone,
      email: user.email,
      subscriptionPlan: user.subscriptionPlan,
      role: user.role,
      updatedAt: user.updatedAt,
    })

  return rows[0] ?? null
}
