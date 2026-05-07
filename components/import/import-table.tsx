import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ImportListRow } from '@/lib/dal/imports'
import { cn } from '@/lib/utils'

type Props = {
  imports: ImportListRow[]
  loadError?: boolean
}

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const currencyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
})

const statusLabels: Record<ImportListRow['status'], string> = {
  pending_upload: 'In attesa',
  uploaded: 'Caricato',
  analyzing: 'In analisi',
  analyzed: 'Analizzato',
  importing: 'Importazione',
  imported: 'Importato',
  failed: 'Errore',
}

const statusClasses: Record<ImportListRow['status'], string> = {
  pending_upload: 'bg-slate-100 text-slate-700',
  uploaded: 'bg-sky-100 text-sky-700',
  analyzing: 'bg-indigo-100 text-indigo-700',
  analyzed: 'bg-violet-100 text-violet-700',
  importing: 'bg-amber-100 text-amber-700',
  imported: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-destructive/10 text-destructive',
}

function formatDate(date: Date | null) {
  return date ? dateFormatter.format(new Date(date)) : '—'
}

function formatDateRange(start: Date | null, end: Date | null) {
  if (!start && !end) {
    return '—'
  }

  if (start && end) {
    return `${formatDate(start)} – ${formatDate(end)}`
  }

  return start ? `Da ${formatDate(start)}` : `Fino a ${formatDate(end)}`
}

function formatCurrency(amount: string) {
  const value = Number(amount)

  if (!Number.isFinite(value)) {
    return amount
  }

  return currencyFormatter.format(value)
}

function getImportDisplayName(row: ImportListRow) {
  return row.displayName?.trim() || row.originalName
}

export function ImportTable({ imports, loadError = false }: Props) {
  if (loadError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <p className="text-base font-medium text-foreground" role="alert">
            Storico importazioni non disponibile
          </p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Il caricamento dei file resta disponibile. Riprova più tardi per
            controllare stati e statistiche delle importazioni.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (imports.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <p className="text-base font-medium text-foreground">
            Nessuna importazione trovata
          </p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Carica un estratto conto per vedere qui stato, statistiche e intervallo
            di riferimento delle prossime importazioni.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <Table>
        <TableCaption className="sr-only">
          Storico importazioni con stato, piattaforma, date, statistiche e messaggi
          di errore sicuri.
        </TableCaption>
        <TableHeader>
          <TableRow className="bg-secondary/70">
            <TableHead className="min-w-[18rem] text-xs font-normal uppercase tracking-wide text-muted-foreground">
              File
            </TableHead>
            <TableHead className="w-36 text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Stato
            </TableHead>
            <TableHead className="min-w-[10rem] text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Piattaforma
            </TableHead>
            <TableHead className="min-w-[12rem] text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Date
            </TableHead>
            <TableHead className="w-28 text-right text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Righe
            </TableHead>
            <TableHead className="w-36 text-right text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Totali
            </TableHead>
            <TableHead className="min-w-[12rem] text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Periodo
            </TableHead>
            <TableHead className="min-w-[16rem] text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Messaggio
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {imports.map((row) => {
            const displayName = getImportDisplayName(row)
            const hasFailureMessage = row.status === 'failed' && row.errorMessage

            return (
              <TableRow key={row.id}>
                <TableCell className="max-w-[24rem]">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate font-medium" title={displayName}>
                      {displayName}
                    </span>
                    {row.displayName ? (
                      <span
                        className="truncate text-xs text-muted-foreground"
                        title={row.originalName}
                      >
                        {row.originalName}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn('border-0', statusClasses[row.status])}
                  >
                    {statusLabels[row.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {row.platformName ?? 'Piattaforma non disponibile'}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 text-sm">
                    <span>Caricato: {formatDate(row.uploadedAt)}</span>
                    <span className="text-muted-foreground">
                      Importato: {formatDate(row.importedAt)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  <div className="flex flex-col gap-1">
                    <span>{row.rowCount}</span>
                    <span className="text-muted-foreground">
                      {row.importedCount} importate
                    </span>
                    <span className="text-muted-foreground">
                      {row.duplicateCount} duplicate
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  <div className="flex flex-col gap-1">
                    <span className="text-emerald-700">
                      {formatCurrency(row.negativeTotal)}
                    </span>
                    <span>{formatCurrency(row.positiveTotal)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {formatDateRange(row.referenceStartedAt, row.referenceEndedAt)}
                </TableCell>
                <TableCell className="max-w-[18rem]">
                  {hasFailureMessage ? (
                    <p
                      className="line-clamp-2 whitespace-normal text-sm text-destructive"
                      title={row.errorMessage ?? undefined}
                    >
                      {row.errorMessage}
                    </p>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
