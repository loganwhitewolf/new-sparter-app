import Link from 'next/link'
import { MARKETING_ROUTES } from '@/lib/routes'

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="text-xl font-semibold text-foreground">Termini</h1>
      <p className="mt-4 text-base text-foreground">Contenuto in arrivo.</p>
      <Link
        href={MARKETING_ROUTES.home}
        className="mt-6 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        Torna alla home
      </Link>
    </div>
  )
}
