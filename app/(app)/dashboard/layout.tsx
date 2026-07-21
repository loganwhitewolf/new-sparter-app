import { Suspense } from 'react'
import { DashboardTabNav } from '@/components/dashboard/dashboard-tab-nav'

function DashboardTabNavFallback() {
  return (
    <nav className="flex border-b" aria-label="Navigazione dashboard">
      <div className="px-4 py-2 text-sm font-medium text-muted-foreground">Overview</div>
      <div className="px-4 py-2 text-sm font-medium text-muted-foreground">Categorie</div>
      <div className="px-4 py-2 text-sm font-medium text-muted-foreground">Tag</div>
    </nav>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<DashboardTabNavFallback />}>
        <DashboardTabNav />
      </Suspense>
      {children}
    </div>
  )
}
