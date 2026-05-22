import { RegisterForm } from '@/components/auth/register-form'

type RegisterPageProps = {
  searchParams: Promise<{ error?: string }>
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { error } = await searchParams
  const activeProviders: ('google' | 'github')[] = []
  if (process.env.GOOGLE_CLIENT_ID) activeProviders.push('google')
  if (process.env.GITHUB_CLIENT_ID) activeProviders.push('github')

  return <RegisterForm activeProviders={activeProviders} oauthError={error} />
}
