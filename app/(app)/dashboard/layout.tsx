import { DashboardTabNav } from '@/components/dashboard/dashboard-tab-nav'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-6">
      <DashboardTabNav />
      {children}
    </div>
  )
}
