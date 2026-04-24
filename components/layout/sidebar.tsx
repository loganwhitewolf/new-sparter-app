'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Receipt, Settings, Tag, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const topNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/expenses', label: 'Spese', icon: Receipt },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/categories', label: 'Categorie', icon: Tag },
]

const bottomNavItems = [
  { href: '/settings', label: 'Impostazioni', icon: Settings },
]

const uncategorizedCount = 0

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav className="flex h-full w-full flex-col bg-secondary px-3 py-4">
      <ul className="flex flex-1 flex-col gap-1">
        {topNavItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`)

          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-l-2 border-primary bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {label === 'Categorie' && uncategorizedCount > 0 ? (
                  <Badge className="ml-auto font-mono text-xs">
                    {uncategorizedCount}
                  </Badge>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="mt-auto">
        <Separator className="my-2" />
        <ul className="flex flex-col gap-1">
          {bottomNavItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`)

            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-l-2 border-primary bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
