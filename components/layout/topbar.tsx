'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { LogOut, User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/lib/auth-client'
import { signOutAction } from '@/lib/actions/auth'
import { APP_ROUTES } from '@/lib/routes'

function ThemeTogglePlaceholder() {
  return (
    <span
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md"
      aria-hidden
    />
  )
}

const ThemeToggle = dynamic(
  () => import('@/components/theme-toggle').then((m) => ({ default: m.ThemeToggle })),
  { ssr: false, loading: ThemeTogglePlaceholder },
)

export function Topbar() {
  const { data: session } = authClient.useSession()
  const email = session?.user?.email ?? ''
  const fallback = email.charAt(0).toUpperCase() || 'U'

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center">
        <span className="text-lg font-semibold tracking-tight">Sparter</span>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
        <DropdownMenuTrigger aria-label="Menu utente" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="h-8 w-8">
            <AvatarImage src="" alt="Avatar utente" />
            <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
              {fallback}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="truncate text-sm font-medium">{email || 'Utente'}</p>
              <p className="truncate text-xs text-muted-foreground">{email || 'utente@example.com'}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={APP_ROUTES.profileSettings}>
              <User className="mr-2 h-4 w-4" />
              Profilo
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => signOutAction()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
