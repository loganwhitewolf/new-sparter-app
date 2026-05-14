export default function DashboardOverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Panoramica delle tue finanze</p>
      </div>
      <p className="text-muted-foreground text-sm">Caricamento in corso...</p>
    </div>
  )
}
