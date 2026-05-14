'use client'

import Link from 'next/link'
import { Clock, ExternalLink, MoreHorizontal, Pencil, Settings, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ImportListRow } from '@/lib/dal/imports'
import { isInProgress, isUnknownFormatFailed } from '@/lib/utils/import-status'

type Props = {
  row: ImportListRow
  displayName: string
  onRename: (row: ImportListRow) => void
  onDelete: (row: ImportListRow) => void
  onDeleteStale: (row: ImportListRow) => void
}

export function ImportRowActions({ row, displayName, onRename, onDelete, onDeleteStale }: Props) {
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
      {row.status === 'failed' && (
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

          {row.status === 'imported' && (
            <DropdownMenuItem asChild>
              <Link href={`/transactions?importId=${encodeURIComponent(row.id)}`}>
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                Vedi transazioni
              </Link>
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
