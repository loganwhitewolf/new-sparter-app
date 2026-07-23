import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AUTH_PAGE_ROUTES } from '@/lib/routes'

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-12 text-center">
      <span className="text-2xl font-semibold tracking-tight text-foreground">Sparter</span>
      <p className="mt-4 text-base text-foreground">
        Carica i tuoi estratti. Sparter li categorizza — senza collegare la banca.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Button asChild size="lg">
          <Link href={AUTH_PAGE_ROUTES.register}>Registrati</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={AUTH_PAGE_ROUTES.login}>Entra</Link>
        </Button>
      </div>
    </div>
  )
}
