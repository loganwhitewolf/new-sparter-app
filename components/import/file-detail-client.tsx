'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import type { FileDetailContextRow, FileTransactionRow } from '@/lib/types/file-detail'
import { DETAIL_LINKED_TRANSACTIONS_PREVIEW_LIMIT } from '@/lib/constants/detail-page-limits'
import { APP_ROUTES, transactionDetailHref } from '@/lib/routes'
import { AMOUNT_TONE_CLASS, amountToneClass } from '@/lib/utils/amount-tone'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'
import { cn } from '@/lib/utils'

type Props = {
  file: FileDetailContextRow
  transactions: FileTransactionRow[]
}

const LINKED_TRANSACTIONS_PREVIEW_LIMIT = DETAIL_LINKED_TRANSACTIONS_PREVIEW_LIMIT

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

  const previewTransactions = transactions.slice(0, LINKED_TRANSACTIONS_PREVIEW_LIMIT)
  const totalLinkedCount = file.importedCount
  const hiddenTransactionsCount = Math.max(0, totalLinkedCount - previewTransactions.length)

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
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Piattaforma
        </span>
        <span className="text-sm">{file.platformName ?? '—'}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Importato il
        </span>
        <span className="text-sm">{formatDate(file.importedAt)}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Periodo coperto
        </span>
        <span className="text-sm">{formatPeriod(file.referenceStartedAt, file.referenceEndedAt)}</span>
      </div>
    </div>
  )

  const collegamentiCard = (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Collegamenti
      </span>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Transazioni importate</span>
        <Link
          href={`/transactions?importId=${encodeURIComponent(file.id)}`}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Vedi tutte ({totalLinkedCount})
        </Link>
      </div>
    </div>
  )

  const azioniCard = (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Azioni
      </span>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          onClick={handleDownload}
          disabled={isDownloadPending}
        >
          <Download className="h-4 w-4" />
          {isDownloadPending ? 'Preparazione…' : 'Scarica file'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          onClick={() => void handleRecheckRegex()}
          disabled={isRecheckPending}
        >
          <Sparkles className="h-4 w-4" />
          {isRecheckPending ? 'Ricerca in corso…' : 'Rivedi suggerimenti'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          Elimina
        </Button>
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
        <span className={cn('font-mono text-sm tabular-nums', AMOUNT_TONE_CLASS.positive)}>
          {formatAbsoluteAmount(file.positiveTotal)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Uscite</span>
        <span className={cn('font-mono text-sm tabular-nums', AMOUNT_TONE_CLASS.negative)}>
          {formatAbsoluteAmount(file.negativeTotal)}
        </span>
      </div>
    </div>
  )

  const transactionsCard = (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Transazioni
      </span>
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
              {previewTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-sm whitespace-normal break-words align-top">
                    <Link
                      href={transactionDetailHref(tx.id)}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {tx.customTitle ?? tx.description}
                    </Link>
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-mono tabular-nums text-sm whitespace-nowrap align-top',
                      amountToneClass(tx.amount, tx.categoryType),
                    )}
                  >
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
      {hiddenTransactionsCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          Mostrate {previewTransactions.length} di {totalLinkedCount} transazioni importate.
        </p>
      ) : null}
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
        layout="file-detail"
        datiCard={datiCard}
        collegamentiCard={collegamentiCard}
        azioniCard={azioniCard}
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
