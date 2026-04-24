export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Panoramica delle tue finanze
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-lg font-medium">Nessuna spesa ancora</p>
        <p className="text-sm text-muted-foreground">
          Importa il tuo primo file CSV o aggiungi una spesa manualmente.
        </p>
      </div>
    </div>
  )
}
