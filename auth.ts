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
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {}),
    ...(process.env.GITHUB_CLIENT_ID
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          },
        }
      : {}),
  },
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  user: {
    additionalFields: {
      firstName: {
        type: 'string',
        required: false,
        input: false,
      },
      lastName: {
        type: 'string',
        required: false,
        input: false,
      },
      jobTitle: {
        type: 'string',
        required: false,
        input: false,
      },
      location: {
        type: 'string',
        required: false,
        input: false,
      },
      phone: {
        type: 'string',
        required: false,
        input: false,
      },
      timezone: {
        type: 'string',
        required: false,
        input: false,
      },
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
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'github'],
      requireLocalEmailVerified: false,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          return { data: { ...user, emailVerified: true } }
        },
      },
    },
  },
  plugins: [nextCookies()],
})
