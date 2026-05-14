'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, List, Receipt, Upload } from 'lucide-react'
import { ClientMountIcon } from '@/components/ui/client-mount-icon'
import { cn } from '@/lib/utils'
import { APP_ROUTES } from '@/lib/routes'

const navItems = [
  { href: APP_ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard },
  { href: APP_ROUTES.expenses, label: 'Spese', icon: Receipt },
  { href: APP_ROUTES.transactions, label: 'Transazioni', icon: List },
  { href: APP_ROUTES.import, label: 'Importazioni', icon: Upload },
]

interface BottomNavProps {
  className?: string
}

export function BottomNav({ className }: BottomNavProps) {
  const pathname = usePathname()

  return (
    <nav
      data-bottom-nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 flex h-16 items-center border-t border-border bg-background',
        className
      )}
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`)

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 py-2 text-xs',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <ClientMountIcon icon={Icon} className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
