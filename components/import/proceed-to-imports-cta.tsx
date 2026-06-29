import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { APP_ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
  variant?: 'default' | 'outline' | 'secondary'
}

export function ProceedToImportsCta({ className, variant = 'default' }: Props) {
  return (
    <Button asChild variant={variant} className={cn('self-start', className)}>
      <Link href={APP_ROUTES.import}>
        Procedi — vai ai file importati
        <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
      </Link>
    </Button>
  )
}
