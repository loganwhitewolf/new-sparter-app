'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  FolderTree,
  LayoutDashboard,
  List,
  LogOut,
  Receipt,
  Settings,
  Upload,
  User,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ClientMountIcon } from '@/components/ui/client-mount-icon'
import { Separator } from '@/components/ui/separator'
import { useSidebarCollapsed } from '@/components/layout/sidebar-provider'
import { signOutAction } from '@/lib/actions/auth'
import { cn } from '@/lib/utils'
import { APP_ROUTES } from '@/lib/routes'

type UserDisplay = { name: string; email: string; image: string | null }

const topNavItems = [
  { href: APP_ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard },
  { href: APP_ROUTES.transactions, label: 'Transazioni', icon: List },
  { href: APP_ROUTES.expenses, label: 'Spese', icon: Receipt },
  { href: APP_ROUTES.import, label: 'Importazioni', icon: Upload },
  { href: APP_ROUTES.categorySettings, label: 'Categorie', icon: FolderTree },
]

export function Sidebar({ user }: { user: UserDisplay }) {
  const { collapsed, setCollapsed } = useSidebarCollapsed()
  const pathname = usePathname()

  // Delay tooltip rendering until after client mount to avoid SSR/hydration mismatch (Pitfall 6)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    queueMicrotask(() => setMounted(true))
  }, [])

  const { email, name, image } = user
  const fallback = email.charAt(0).toUpperCase() || 'U'

  return (
    <nav
      aria-label="Navigazione principale"
      className={cn(
        'flex h-full w-full flex-col bg-secondary py-4',
        collapsed ? 'px-2' : 'px-3'
      )}
    >
      {/* TOP SLOT: wordmark + toggle button (D-04/D-06) */}
      <div
        className={cn(
          'mb-4 flex items-center',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        {!collapsed && (
          <span className="text-lg font-semibold tracking-tight">Sparter</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Espandi barra laterale' : 'Comprimi barra laterale'}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* NAV LIST + SETTINGS LINK: wrapped in a single TooltipProvider so collapsed tooltips work */}
      <TooltipProvider>
        <ul className="flex flex-1 flex-col gap-1">
          {topNavItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`)

            const linkNode = (
              <Link
                href={href}
                className={cn(
                  'flex items-center rounded-md py-2 text-sm font-medium transition-colors',
                  collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                  isActive
                    ? 'border-l-2 border-primary bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <ClientMountIcon icon={Icon} className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="flex-1">{label}</span>}
              </Link>
            )

            return (
              <li key={href}>
                {collapsed && mounted ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{linkNode}</TooltipTrigger>
                    <TooltipContent side="right">{label}</TooltipContent>
                  </Tooltip>
                ) : (
                  linkNode
                )}
              </li>
            )
          })}
        </ul>

        {/* SETTINGS LINK: Impostazioni hub (Profilo + Tag + theme) */}
        <Separator className="my-2" />
        {(() => {
          const isActive =
            pathname === APP_ROUTES.settings ||
            (pathname.startsWith(`${APP_ROUTES.settings}/`) &&
              !pathname.startsWith(APP_ROUTES.categorySettings))
          const linkNode = (
            <Link
              href={APP_ROUTES.settings}
              className={cn(
                'flex items-center rounded-md py-2 text-sm font-medium transition-colors',
                collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                isActive
                  ? 'border-l-2 border-primary bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <ClientMountIcon icon={Settings} className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="flex-1">Impostazioni</span>}
            </Link>
          )
          return collapsed && mounted ? (
            <Tooltip>
              <TooltipTrigger asChild>{linkNode}</TooltipTrigger>
              <TooltipContent side="right">Impostazioni</TooltipContent>
            </Tooltip>
          ) : linkNode
        })()}
      </TooltipProvider>

      {/* BOTTOM SLOT: user avatar dropdown migrated from topbar (D-07/D-08) */}
      <div className="mt-auto">
        <Separator className="my-2" />
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Menu utente"
            className={cn(
              'flex w-full items-center rounded-md py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-accent transition-colors',
              collapsed ? 'justify-center px-2' : 'gap-3 px-3'
            )}
          >
            <Avatar className="h-8 w-8 shrink-0">
              {image && (
                <AvatarImage src={image} alt="Avatar utente" />
              )}
              <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
                {fallback}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex min-w-0 flex-col text-left">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs text-muted-foreground">{email}</p>
              </div>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs text-muted-foreground">{email}</p>
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
    </nav>
  )
}
