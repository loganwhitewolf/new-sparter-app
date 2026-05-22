import { LoginForm } from '@/components/auth/login-form'

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams
  const activeProviders: ('google' | 'github')[] = []
  if (process.env.GOOGLE_CLIENT_ID) activeProviders.push('google')
  if (process.env.GITHUB_CLIENT_ID) activeProviders.push('github')

  return <LoginForm activeProviders={activeProviders} oauthError={error} />
}
