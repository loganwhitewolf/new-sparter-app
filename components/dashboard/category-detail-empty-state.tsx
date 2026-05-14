type Props = {
  title?: string
  description?: string
}

export function CategoryDetailEmptyState({
  title = 'Nessun dato per questa categoria',
  description = 'Cambia periodo o torna alla dashboard categorie per scegliere un altro filtro.',
}: Props) {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center">
      <div className="max-w-md space-y-2">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
