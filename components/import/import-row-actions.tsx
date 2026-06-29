'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { Clock, Download, ExternalLink, MoreHorizontal, Pencil, Settings, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ImportListRow } from '@/lib/dal/imports'
import { canDownloadImportFile, isInProgress, isUnknownFormatFailed } from '@/lib/utils/import-status'

type Props = {
  row: ImportListRow
  displayName: string
  onRename: (row: ImportListRow) => void
  onDelete: (row: ImportListRow) => void
  onDeleteStale: (row: ImportListRow) => void
  /** Callback for the per-row on-demand regex re-check (TRIG-02, D-01). */
  onRecheckRegex: (row: ImportListRow) => void
  /** True while the re-check action is pending — disables the menu item. */
  isRecheckPending?: boolean
}

export function ImportRowActions({ row, displayName, onRename, onDelete, onDeleteStale, onRecheckRegex, isRecheckPending }: Props) {
  const [isDownloadPending, startDownloadTransition] = useTransition()

  function handleDownload() {
    startDownloadTransition(async () => {
      try {
        const response = await fetch(`/api/files/${encodeURIComponent(row.id)}/download`)
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

  if (row.status === 'analyzing') {
    return (
      <div
        className="flex items-center justify-end gap-1.5 text-sm text-muted-foreground"
        aria-label="Analisi in corso, nessuna azione disponibile"
      >
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Analisi…</span>
      </div>
    )
  }

  if (row.status === 'importing') {
    return (
      <div
        className="flex items-center justify-end gap-1.5 text-sm text-muted-foreground"
        aria-label="Importazione in corso, nessuna azione disponibile"
      >
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Importazione…</span>
      </div>
    )
  }

  const unknownFormat = row.status === 'failed' && isUnknownFormatFailed(row)

  return (
    <div className="flex items-center justify-end gap-1">
      {/* Primary CTA button — varies by state */}
      {row.status === 'uploaded' && (
        <Button asChild size="sm" variant="outline" aria-label={`Analizza ${displayName}`}>
          <Link href={`/import/${encodeURIComponent(row.id)}/analyze`}>Analizza</Link>
        </Button>
      )}
      {row.status === 'analyzed' && (
        <Button asChild size="sm" variant="outline" aria-label={`Rivedi e importa ${displayName}`}>
          <Link href={`/import/${encodeURIComponent(row.id)}/analyze`}>Rivedi e importa</Link>
        </Button>
      )}
      {row.status === 'failed' && unknownFormat && (
        <Button
          asChild
          size="sm"
          variant="outline"
          aria-label={`Configura formato per ${displayName}`}
        >
          <Link href={`/import/${encodeURIComponent(row.id)}/configure`}>
            <Settings className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Configura formato</span>
          </Link>
        </Button>
      )}
      {row.status === 'failed' && !unknownFormat && (
        <Button asChild size="sm" variant="outline" aria-label={`Riprova analisi di ${displayName}`}>
          <Link href={`/import/${encodeURIComponent(row.id)}/analyze`}>Riprova analisi</Link>
        </Button>
      )}

      {/* Overflow menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`Altre azioni per ${displayName}`}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => onRename(row)}>
            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
            Rinomina
          </DropdownMenuItem>

          {canDownloadImportFile(row) && (
            <DropdownMenuItem onClick={handleDownload} disabled={isDownloadPending}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              {isDownloadPending ? 'Preparazione…' : 'Scarica file originale'}
            </DropdownMenuItem>
          )}

          {row.status === 'imported' && (
            <DropdownMenuItem asChild>
              <Link href={`/transactions?importId=${encodeURIComponent(row.id)}`}>
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                Vedi transazioni
              </Link>
            </DropdownMenuItem>
          )}

          {/* Per-row on-demand re-check (TRIG-02, D-01): triggers recheckRegexAction on the client.
              Shown only for imported rows; disabled while a re-check is in progress.
              Navigates to suggestions page when candidates are found (D-03). */}
          {row.status === 'imported' && (
            <DropdownMenuItem
              onClick={() => onRecheckRegex(row)}
              disabled={isRecheckPending}
            >
              <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
              {isRecheckPending ? 'Ricerca in corso…' : 'Rivedi suggerimenti'}
            </DropdownMenuItem>
          )}

          {row.status === 'failed' && row.errorMessage && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <p className="mb-1 text-xs font-medium text-destructive">Errore</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {row.errorMessage}
                </p>
              </div>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            onClick={() =>
              row.status === 'imported' ? onDelete(row) : onDeleteStale(row)
            }
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Elimina
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** Returns true when the row is in an active processing state (no user actions). */
export { isInProgress }
