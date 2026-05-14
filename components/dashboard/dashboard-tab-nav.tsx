'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { APP_ROUTES } from '@/lib/routes'

const tabs = [
  { href: APP_ROUTES.dashboardOverview, label: 'Overview' },
  { href: APP_ROUTES.dashboardCategories, label: 'Categorie' },
]

export function DashboardTabNav() {
  const pathname = usePathname()

  return (
    <nav className="flex border-b">
      {tabs.map(({ href, label }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`)

        return (
          <Link
            key={href}
            href={href}
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
