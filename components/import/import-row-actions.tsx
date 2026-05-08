'use client'

import Link from 'next/link'
import { Clock, ExternalLink, Settings, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ImportListRow } from '@/lib/dal/imports'
import { isInProgress, isUnknownFormatFailed } from '@/lib/utils/import-status'

type Props = {
  row: ImportListRow
  displayName: string
  onDelete: (row: ImportListRow) => void
}

/**
 * Renders the lifecycle-appropriate action buttons for a single import row.
 *
 * State matrix (Italian UI labels are user-facing product copy):
 * - pending_upload  : no primary action; rename is always in the parent table
 * - uploaded        : analyze link
 * - analyzing       : disabled in-progress copy, no active controls
 * - analyzed        : review-and-import link
 * - importing       : disabled in-progress copy, no active controls
 * - imported        : view-transactions link + delete button
 * - failed (unknown-format): configure-format link + retry-analysis link
 * - failed (other)  : retry-analysis link only
 *
 * Delete is available only for imported rows.
 * Rename is always rendered by the parent table (not here).
 */
export function ImportRowActions({ row, displayName, onDelete }: Props) {
  if (row.status === 'analyzing') {
    return (
      <div
        className="flex items-center justify-end gap-1.5 text-sm text-muted-foreground"
        aria-label="Analisi in corso, nessuna azione disponibile"
      >
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Analisi in corso…</span>
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
        <span>Importazione in corso…</span>
      </div>
    )
  }

  if (row.status === 'uploaded') {
    return (
      <div className="flex justify-end">
        <Button
          asChild
          size="sm"
          variant="outline"
          aria-label={`Analizza importazione ${displayName}`}
        >
          <Link href={`/import/${encodeURIComponent(row.id)}/analyze`}>
            Analizza
          </Link>
        </Button>
      </div>
    )
  }

  if (row.status === 'analyzed') {
    return (
      <div className="flex justify-end">
        <Button
          asChild
          size="sm"
          variant="outline"
          aria-label={`Rivedi e importa ${displayName}`}
        >
          <Link href={`/import/${encodeURIComponent(row.id)}/analyze`}>
            Rivedi e importa
          </Link>
        </Button>
      </div>
    )
  }

  if (row.status === 'imported') {
    return (
      <div className="flex justify-end gap-2">
        <Button
          asChild
          size="sm"
          variant="ghost"
          aria-label={`Vedi transazioni importate da ${displayName}`}
        >
          <Link href={`/transactions?importId=${encodeURIComponent(row.id)}`}>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Vedi transazioni</span>
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete(row)}
          aria-label={`Elimina importazione ${displayName}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          <span>Elimina</span>
        </Button>
      </div>
    )
  }

  if (row.status === 'failed') {
    const unknownFormat = isUnknownFormatFailed(row)

    return (
      <div className="flex justify-end gap-2">
        {unknownFormat ? (
          <Button
            asChild
            size="sm"
            variant="outline"
            aria-label={`Configura formato privato per ${displayName}`}
          >
            <Link href={`/import/${encodeURIComponent(row.id)}/configure`}>
              <Settings className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Configura formato</span>
            </Link>
          </Button>
        ) : null}
        <Button
          asChild
          size="sm"
          variant="outline"
          aria-label={`Riprova analisi di ${displayName}`}
        >
          <Link href={`/import/${encodeURIComponent(row.id)}/analyze`}>
            Riprova analisi
          </Link>
        </Button>
      </div>
    )
  }

  // pending_upload: no primary action available yet
  return null
}

/** Returns true when the row is in an active processing state (no user actions). */
export { isInProgress }
