'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { signInAction } from '@/lib/actions/auth'

export default function LoginPage() {
  const [state, action, isPending] = useActionState(signInAction, { error: null })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-semibold">Accedi</h1>
        <p className="text-sm text-muted-foreground">
          Inserisci le tue credenziali per accedere.
        </p>
      </div>
      {state.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <form action={action} className="flex flex-col gap-3">
        <Input
          type="email"
          name="email"
          placeholder="Email"
          autoComplete="email"
        />
        <Input
          type="password"
          name="password"
          placeholder="Password"
          autoComplete="current-password"
        />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Accedi
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Non hai un account?{' '}
        <Link
          href="/register"
          className="text-foreground underline underline-offset-4 hover:text-primary"
        >
          Registrati
        </Link>
      </p>
    </div>
  )
}
