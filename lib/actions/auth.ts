'use server'
import { auth } from '@/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { LoginSchema, RegisterSchema } from '@/lib/validations/auth'
import { getSafeSignUpErrorMessage } from '@/lib/actions/auth-errors'

export type { AuthActionState } from '@/lib/validations/auth'

export async function signInAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    // D-05: generic message — Zod error treated same as auth error (no field-level leakage)
    return { error: 'Credenziali non valide. Riprova o contatta il supporto.' }
  }
  try {
    await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: await headers(),
    })
  } catch {
    // D-05: generic message — never reveal whether email exists
    return { error: 'Credenziali non valide. Riprova o contatta il supporto.' }
  }
  redirect('/dashboard')
}

export async function signUpAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const parsed = RegisterSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    // D-06: generic message — no field-level error details
    return { error: 'Si è verificato un errore. Riprova.' }
  }
  try {
    await auth.api.signUpEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
        name: parsed.data.email, // Pitfall 1: Better Auth requires 'name' — use email as placeholder (D-01)
      },
      headers: await headers(),
    })
  } catch (error) {
    // D-06: keep credential/account errors generic, but surface safe local DB setup failures.
    return { error: getSafeSignUpErrorMessage(error) }
  }
  redirect('/dashboard') // D-02: auto-login via autoSignIn:true → redirect directly to dashboard
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() })
  redirect('/login')
}
