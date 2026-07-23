import Link from 'next/link'
import { APP_ROUTES, AUTH_PAGE_ROUTES, MARKETING_ROUTES } from '@/lib/routes'

const FOOTER_LINK_CLASSNAME = 'text-sm text-muted-foreground hover:text-foreground'

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href={MARKETING_ROUTES.home}
            className="text-2xl font-semibold tracking-tight text-foreground"
          >
            Sparter
          </Link>
          <nav aria-label="Link utili" className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href={MARKETING_ROUTES.howItWorks} className={FOOTER_LINK_CLASSNAME}>
              Come funziona
            </Link>
            <Link href={MARKETING_ROUTES.privacy} className={FOOTER_LINK_CLASSNAME}>
              Privacy
            </Link>
            <Link href={MARKETING_ROUTES.terms} className={FOOTER_LINK_CLASSNAME}>
              Termini
            </Link>
            <Link href={AUTH_PAGE_ROUTES.login} className={FOOTER_LINK_CLASSNAME}>
              Entra
            </Link>
            <Link href={AUTH_PAGE_ROUTES.register} className={FOOTER_LINK_CLASSNAME}>
              Registrati
            </Link>
            <Link href={APP_ROUTES.dashboard} className={FOOTER_LINK_CLASSNAME}>
              Dashboard
            </Link>
          </nav>
        </div>
        {/* Evaluated at build time — the (public) group is statically prerendered, so this
            year is baked in and goes stale across a calendar-year boundary until the next
            deploy. Accepted: forcing dynamic rendering here would cost the static win. */}
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Sparter</p>
      </div>
    </footer>
  )
}
