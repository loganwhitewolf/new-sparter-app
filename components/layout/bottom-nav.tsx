'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Receipt, Tag, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/spese', label: 'Spese', icon: Receipt },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/categories', label: 'Categorie', icon: Tag },
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
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
