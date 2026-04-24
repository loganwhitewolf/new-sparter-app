import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-semibold">Accedi</h1>
        <p className="text-sm text-muted-foreground">
          Inserisci le tue credenziali per accedere.
        </p>
      </div>
      <form className="flex flex-col gap-3">
        <Input type="email" placeholder="Email" autoComplete="email" />
        <Input
          type="password"
          placeholder="Password"
          autoComplete="current-password"
        />
        <Button type="submit" className="w-full">
          Accedi
        </Button>
      </form>
    </div>
  )
}
