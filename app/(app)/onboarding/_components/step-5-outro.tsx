import Link from 'next/link'
import { CheckCircle, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { APP_ROUTES } from '@/lib/routes'

export function Step5Outro() {
  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-6 pb-10 text-center text-foreground">
      <div className="mb-8 inline-flex h-24 w-24 items-center justify-center rounded-full bg-foreground/10">
        <CheckCircle className="h-12 w-12 text-success" aria-hidden="true" />
      </div>

      <h1 className="mb-3 text-4xl font-bold">Benvenuto in Sparter!</h1>
      <p className="mb-12 max-w-xs text-base text-muted-foreground">
        Il tuo primo estratto è pronto. Cosa vuoi fare adesso?
      </p>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Button asChild size="lg" className="w-full">
          <Link href={APP_ROUTES.dashboard}>
            Vai alla dashboard
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link href={APP_ROUTES.categorySettings}>
            Personalizza le categorie
          </Link>
        </Button>
      </div>
    </div>
  )
}
