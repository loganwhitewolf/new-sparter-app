'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DetailPageShell } from '@/components/detail-pages/detail-page-shell'
import { ImportDeleteDialog } from '@/components/import/import-delete-dialog'
import { ImportDisplayNameEdit } from '@/components/import/import-display-name-edit'
import { recheckRegexAction } from '@/lib/actions/import'
import type { FileDetailContextRow } from '@/lib/dal/files'
import type { FileTransactionRow } from '@/lib/dal/transactions'
import { APP_ROUTES, transactionDetailHref } from '@/lib/routes'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'

type Props = {
  file: FileDetailContextRow
  transactions: FileTransactionRow[]
}

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function formatDate(date: Date | null): string {
  if (!date) return '—'
  return dateFormatter.format(new Date(date))
}

function formatPeriod(start: Date | null, end: Date | null): string {
  if (!start || !end) return '—'
  return `${formatDate(start)} – ${formatDate(end)}`
}

function formatTransactionAmount(amount: string, currency: string): string {
  const num = parseFloat(amount)
  if (!Number.isFinite(num)) return amount
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency,
  }).format(num)
}

export function FileDetailClient({ file, transactions }: Props) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDownloadPending, startDownloadTransition] = useTransition()
  const [isRecheckPending, setIsRecheckPending] = useState(false)

  const displayTitle = file.displayName?.trim() || file.originalName

  function handleDownload() {
    startDownloadTransition(async () => {
      try {
        const response = await fetch(`/api/files/${encodeURIComponent(file.id)}/download`)
        const payload = (await response.json()) as {
          download?: { url: string; filename: string }
          error?: { message: string }
        }

        if (!response.ok || !payload.download?.url) {
          toast.error(payload.error?.message ?? 'Impossibile scaricare il file. Riprova.')
          return
        }

        window.open(payload.download.url, '_blank', 'noopener,noreferrer')
      } catch {
        toast.error('Impossibile scaricare il file. Riprova.')
      }
    })
  }

  async function handleRecheckRegex() {
    setIsRecheckPending(true)

    const formData = new FormData()
    formData.set('fileId', file.id)
    const result = await recheckRegexAction(formData)

    setIsRecheckPending(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    const total = (result.data?.candidatesCount ?? 0) + (result.data?.singleCount ?? 0)

    if (total === 0) {
      toast('Nessun pattern trovato per questa piattaforma')
      return
    }

    router.push(`/import/${encodeURIComponent(file.id)}/suggestions`)
  }

  function handleDeleted() {
    toast.success('Importazione eliminata.')
    router.push(APP_ROUTES.import)
  }

  const datiCard = (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Piattaforma</span>
        <span className="text-sm">{file.platformName ?? '—'}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Importato il</span>
        <span className="text-sm">{formatDate(file.importedAt)}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Periodo coperto</span>
        <span className="text-sm">{formatPeriod(file.referenceStartedAt, file.referenceEndedAt)}</span>
      </div>
    </div>
  )

  const riepilogoCard = (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Riepilogo
      </span>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Righe totali</span>
        <span className="text-sm">{file.rowCount}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Importate</span>
        <span className="text-sm">{file.importedCount}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Duplicate</span>
        <span className="text-sm">{file.duplicateCount}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Entrate</span>
        <span className="font-mono text-sm tabular-nums text-total-in">
          {formatAbsoluteAmount(file.positiveTotal)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Uscite</span>
        <span className="font-mono text-sm tabular-nums text-total-out">
          {formatAbsoluteAmount(file.negativeTotal)}
        </span>
      </div>
    </div>
  )

  const transactionsCard = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Transazioni
        </span>
        <Link
          href={`/transactions?importId=${encodeURIComponent(file.id)}`}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Vedi tutte
        </Link>
      </div>
      {transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessuna transazione collegata.</p>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/70">
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-normal">
                  Descrizione
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground font-normal">
                  Importo
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground font-normal">
                  Data
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-sm whitespace-normal break-words align-top">
                    <Link
                      href={transactionDetailHref(tx.id)}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {tx.customTitle ?? tx.description}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm whitespace-nowrap align-top">
                    {formatTransactionAmount(tx.amount, tx.currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm whitespace-nowrap align-top">
                    {formatDate(tx.occurredAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )

  return (
    <>
      <DetailPageShell
        backHref={APP_ROUTES.import}
        title={
          <ImportDisplayNameEdit
            fileId={file.id}
            displayName={file.displayName}
            originalName={file.originalName}
            onSuccess={() => router.refresh()}
          />
        }
        primaryAction={
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloadPending}
          >
            {isDownloadPending ? 'Preparazione…' : 'Scarica file'}
          </Button>
        }
        overflowMenu={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Altre azioni">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRecheckRegex} disabled={isRecheckPending}>
                <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                {isRecheckPending ? 'Ricerca in corso…' : 'Rivedi suggerimenti'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  setDeleteOpen(true)
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Elimina
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        datiCard={datiCard}
        riepilogoCard={riepilogoCard}
        transactionsCard={transactionsCard}
      />

      {deleteOpen ? (
        <ImportDeleteDialog
          importRow={{ ...file, platformId: null, platformSlug: null }}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={handleDeleted}
        />
      ) : null}
    </>
  )
}
