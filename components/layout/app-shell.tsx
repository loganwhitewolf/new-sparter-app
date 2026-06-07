'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { useSidebarCollapsed } from '@/components/layout/sidebar-provider'
import { cn } from '@/lib/utils'

/**
 * AppShell: client component that reads SidebarContext to drive the <aside> width.
 * Renders the flex shell (sidebar + main content area) without a top bar (D-01).
 * Used by app/(app)/layout.tsx, wrapped in SidebarProvider.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarCollapsed()

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        data-sidebar
        className={cn(
          'hidden border-r border-border md:flex md:shrink-0 md:flex-col transition-[width] duration-200 ease-in-out overflow-hidden',
          collapsed ? 'md:w-16' : 'md:w-60'
        )}
      >
        <Sidebar />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">{children}</main>
        <BottomNav className="md:hidden" />
      </div>
    </div>
  )
}
