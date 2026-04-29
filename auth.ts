import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { db } from '@/lib/db'

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  user: {
    additionalFields: {
      subscriptionPlan: {
        type: ['free', 'basic', 'pro'] as const,
        required: false,
        defaultValue: 'free',
        input: false,
      },
      role: {
        type: ['user', 'admin'] as const,
        required: false,
        defaultValue: 'user',
        input: false,
      },
    },
  },
  plugins: [nextCookies()],
})
