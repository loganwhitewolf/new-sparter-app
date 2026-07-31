'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { APP_ROUTES } from '@/lib/routes'

const tabs = [
  { href: APP_ROUTES.dashboardOverview, label: 'Overview' },
  { href: APP_ROUTES.dashboardCategories, label: 'Categorie' },
  { href: APP_ROUTES.dashboardTags, label: 'Tag' },
]

export function buildDashboardTabHref(
  href: string,
  searchParams: Pick<URLSearchParams, 'get'>
) {
  const params = new URLSearchParams()
  // D-12: preset is retired from the tab nav — never read, never propagated. `year` is the
  // shared cross-tab parameter now (CLIST-05), read first to match its semantic priority.
  const year = searchParams.get('year')
  const type = searchParams.get('type')
  const sort = searchParams.get('sort')
  const lens = searchParams.get('lens')

  if (year) {
    params.set('year', year)
  }

  if (type) {
    params.set('type', type)
  }

  if (sort) {
    params.set('sort', sort)
  }

  if (lens) {
    params.set('lens', lens)
  }

  const search = params.toString()
  return href + (search ? `?${search}` : '')
}

export function DashboardTabNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <nav className="flex border-b">
      {tabs.map(({ href, label }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`)

        return (
          <Link
            key={href}
            href={buildDashboardTabHref(href, searchParams)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
