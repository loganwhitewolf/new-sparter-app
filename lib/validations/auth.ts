import { z } from 'zod'

export const LoginSchema = z.object({
  email: z.email({ error: 'Email non valida.' }).trim(),
  password: z.string().min(8, { error: 'Password troppo corta.' }),
})

export const RegisterSchema = z.object({
  email: z.email({ error: 'Email non valida.' }).trim(),
  password: z.string().min(8, { error: 'La password deve essere di almeno 8 caratteri.' }),
})

export type LoginInput = z.infer<typeof LoginSchema>
export type RegisterInput = z.infer<typeof RegisterSchema>

export type AuthActionState = { error: string | null }
