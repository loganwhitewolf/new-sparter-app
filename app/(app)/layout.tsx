import { BottomNav } from '@/components/layout/bottom-nav'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        data-sidebar
        className="hidden border-r border-border md:flex md:w-60 md:shrink-0 md:flex-col"
      >
        <Sidebar />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
          {children}
        </main>
        <BottomNav className="md:hidden" />
      </div>
    </div>
  )
}
