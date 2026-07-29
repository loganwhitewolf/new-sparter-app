'use client'
import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { confirmImportAction } from '@/lib/actions/import'
import type { ImportAnalysisResult } from '@/lib/services/import'
import { APP_ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { formatAbsoluteAmount } from '@/lib/utils/format-amount'
import { bucketOfPreviewRow, countPreviewBuckets } from '@/lib/utils/import-preview-buckets'
import {
  applyImportModeFilter,
  defaultRangeWindow,
  periodSpan,
  type ImportMode,
} from '@/lib/utils/import-mode-filter'

type PreviewFilter = 'all' | 'valid' | 'duplicate' | 'error'

const PREVIEW_COLLAPSED_COUNT = 10

const IMPORT_MODE_CHIPS: readonly { key: ImportMode; label: string }[] = [
  { key: 'from-last', label: "Dall'ultima" },
  { key: 'all', label: 'Tutte' },
  { key: 'range', label: 'Intervallo' },
] as const

type FormatCandidate = {
  formatVersionId: number
  platformName: string
  confidence: number
}

type Props = {
  result: ImportAnalysisResult
  candidates?: FormatCandidate[]
  confirmDisabledReason?: string
  returnTo?: string
}

/** Append mode + optional range fields for confirmImportAction (testable without DOM). */
export function appendImportModeFields(
  fd: FormData,
  opts: {
    importMode: ImportMode
    rangeStart?: string
    rangeEnd?: string
  },
): void {
  fd.set('importMode', opts.importMode)
  if (opts.importMode === 'range') {
    if (opts.rangeStart) fd.set('rangeStart', opts.rangeStart)
    if (opts.rangeEnd) fd.set('rangeEnd', opts.rangeEnd)
  }
}

/** Append per-index exclusions for confirmImportAction (mirrors counterpartIds getAll). */
export function appendExcludedRowIndexes(fd: FormData, indexes: readonly number[]): void {
  for (const index of indexes) {
    fd.append('excludedRowIndexes', String(index))
  }
}

/** Mode-filtered rows minus excluded rowIndexes — drives importable counts (D-preview). */
export function rowsWithoutExcluded<T extends { rowIndex: number }>(
  rows: readonly T[],
  excludedRowIndexes: readonly number[],
): T[] {
  if (excludedRowIndexes.length === 0) return [...rows]
  const excluded = new Set(excludedRowIndexes)
  return rows.filter((row) => !excluded.has(row.rowIndex))
}

const periodDateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** Format YYYY-MM-DD as Italian dd/mm/yyyy without UTC day-shift. */
function formatPeriodDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return isoDate
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  return periodDateFormatter.format(new Date(year, month - 1, day))
}

function formatPeriodLabel(start: string | null, end: string | null): string {
  if (!start && !end) return '—'
  if (start && end) return `${formatPeriodDate(start)} – ${formatPeriodDate(end)}`
  return formatPeriodDate(start ?? end!)
}

export function ImportPreview({ result, candidates = [], confirmDisabledReason, returnTo }: Props) {
  const router = useRouter()
  const [selectedFormatVersionId, setSelectedFormatVersionId] = useState<string>(
    result.formatVersionId ? String(result.formatVersionId) : '',
  )
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [discoveryCount, setDiscoveryCount] = useState<number | null>(null)
  const [importedFileId, setImportedFileId] = useState<string | null>(null)
  const submitLock = useRef(false)

  const [importMode, setImportMode] = useState<ImportMode>('from-last')
  const initialRange = defaultRangeWindow(
    result.lastImportedDate ?? null,
    result.filePeriodStart ?? null,
    result.filePeriodEnd ?? null,
  )
  const [rangeStart, setRangeStart] = useState(initialRange.start ?? '')
  const [rangeEnd, setRangeEnd] = useState(initialRange.end ?? '')
  const [excludedRowIndexes, setExcludedRowIndexes] = useState<number[]>([])

  const [activeFilter, setActiveFilter] = useState<PreviewFilter>('all')
  const [expanded, setExpanded] = useState(false)

  const hasErrors = result.errors.length > 0
  const hasWarnings = result.warnings.length > 0

  const modeFilteredRows = useMemo(
    () =>
      applyImportModeFilter({
        rows: result.sampleRows,
        mode: importMode,
        lastImportedDate: result.lastImportedDate ?? null,
        rangeStart: rangeStart || null,
        rangeEnd: rangeEnd || null,
      }),
    [result.sampleRows, result.lastImportedDate, importMode, rangeStart, rangeEnd],
  )

  const excludedSet = useMemo(() => new Set(excludedRowIndexes), [excludedRowIndexes])

  // Importable = mode-filtered minus excluded (counts/chips); table still lists excluded rows.
  const importableRows = useMemo(
    () => rowsWithoutExcluded(modeFilteredRows, excludedRowIndexes),
    [modeFilteredRows, excludedRowIndexes],
  )

  const modeDuplicateCount = useMemo(
    () => importableRows.filter((row) => row.duplicate).length,
    [importableRows],
  )
  const period = useMemo(() => periodSpan(importableRows), [importableRows])

  // Bucket chips operate on the importable subset (D-05 + D-preview).
  const buckets = useMemo(() => countPreviewBuckets(importableRows), [importableRows])

  const filteredRows = useMemo(
    () =>
      activeFilter === 'all'
        ? modeFilteredRows
        : modeFilteredRows.filter((r) => bucketOfPreviewRow(r) === activeFilter),
    [modeFilteredRows, activeFilter],
  )
  const visibleRows = expanded ? filteredRows : filteredRows.slice(0, PREVIEW_COLLAPSED_COUNT)

  function selectFilter(filter: PreviewFilter) {
    setActiveFilter(filter)
    setExpanded(false)
  }

  function selectImportMode(mode: ImportMode) {
    setImportMode(mode)
    setExpanded(false)
  }

  function excludeRow(rowIndex: number) {
    setExcludedRowIndexes((prev) => (prev.includes(rowIndex) ? prev : [...prev, rowIndex]))
  }

  function restoreRow(rowIndex: number) {
    setExcludedRowIndexes((prev) => prev.filter((i) => i !== rowIndex))
  }

  const confidencePct =
    candidates.length > 0 ? Math.round((candidates[0]?.confidence ?? 0) * 100) : null

  async function handleConfirm() {
    if (submitLock.current) return
    submitLock.current = true
    setIsPending(true)
    setError(null)

    const fd = new FormData()
    fd.set('fileId', result.fileId)
    if (selectedFormatVersionId) {
      fd.set('selectedFormatVersionId', selectedFormatVersionId)
    }
    fd.set('overrideWarnings', hasWarnings ? 'true' : 'false')
    appendImportModeFields(fd, {
      importMode,
      rangeStart: rangeStart || undefined,
      rangeEnd: rangeEnd || undefined,
    })
    appendExcludedRowIndexes(fd, excludedRowIndexes)

    try {
      const res = await confirmImportAction(fd)
      if (res.error) {
        setError(res.error)
        submitLock.current = false
        setIsPending(false)
        return
      }
      setSuccess(true)
      // Onboarding returnTo path: always redirect as before
      if (returnTo) {
        router.push(returnTo)
        return
      }
      // Default path: show discovery CTA when candidates found, otherwise redirect to expenses
      const count = res.data?.discoveryCount ?? 0
      if (count > 0) {
        setDiscoveryCount(count)
        setImportedFileId(res.data?.fileId ?? result.fileId)
        // No auto-redirect (D-05)
      } else {
        router.push(APP_ROUTES.expenses)
      }
    } catch {
      setError('Importazione fallita. Riprova.')
      submitLock.current = false
      setIsPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold">Analisi file</h1>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Modalità importazione">
              {IMPORT_MODE_CHIPS.map((chip) => (
                <Button
                  key={chip.key}
                  type="button"
                  size="sm"
                  variant={importMode === chip.key ? 'default' : 'outline'}
                  aria-pressed={importMode === chip.key}
                  data-import-mode={chip.key}
                  onClick={() => selectImportMode(chip.key)}
                >
                  {chip.label}
                </Button>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Verifica i dettagli prima di confermare l&apos;importazione
          </p>
          {importMode === 'range' && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="import-range-start">
                  Da
                </label>
                <input
                  id="import-range-start"
                  type="date"
                  value={rangeStart}
                  onChange={(event) => setRangeStart(event.currentTarget.value)}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="import-range-end">
                  A
                </label>
                <input
                  id="import-range-end"
                  type="date"
                  value={rangeEnd}
                  onChange={(event) => setRangeEnd(event.currentTarget.value)}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                />
              </div>
            </div>
          )}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/import">Torna alle importazioni</Link>
        </Button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryTile label="Righe trovate" value={String(importableRows.length)} />
        <SummaryTile label="Duplicati" value={String(modeDuplicateCount)} />
        <SummaryTile
          label="Transazioni nel periodo"
          value={formatPeriodLabel(period.start, period.end)}
        />
        <SummaryTile label="Piattaforma" value={result.platformName ?? 'Non rilevata'} />
        {confidencePct !== null && (
          <SummaryTile label="Confidenza" value={`${confidencePct}%`} />
        )}
      </div>

      {/* Format override selector */}
      {candidates.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="format-select">
            Formato rilevato
          </label>
          <Select value={selectedFormatVersionId} onValueChange={setSelectedFormatVersionId}>
            <SelectTrigger id="format-select" className="max-w-xs">
              <SelectValue placeholder="Seleziona formato" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((c) => (
                <SelectItem key={c.formatVersionId} value={String(c.formatVersionId)}>
                  {c.platformName} ({Math.round(c.confidence * 100)}%)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Parse/analysis errors */}
      {hasErrors && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Sample rows preview table */}
      {result.sampleRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anteprima transazioni</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 p-0">
            {/* Filter chips with per-bucket counts */}
            <div className="flex flex-wrap gap-2 px-6 pt-1">
              {([
                { key: 'all', label: `Tutte (${buckets.all})` },
                { key: 'valid', label: `Valide (${buckets.valid})` },
                { key: 'duplicate', label: `Duplicate (${buckets.duplicate})` },
                { key: 'error', label: `Errori (${buckets.error})` },
              ] as const).map((chip) => (
                <Button
                  key={chip.key}
                  type="button"
                  size="sm"
                  variant={activeFilter === chip.key ? 'default' : 'outline'}
                  aria-pressed={activeFilter === chip.key}
                  onClick={() => selectFilter(chip.key)}
                >
                  {chip.label}
                </Button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    <TableHead>Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                        Nessuna riga in questa vista.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleRows.map((row) => {
                      const isExcluded = excludedSet.has(row.rowIndex)
                      return (
                      <TableRow
                        key={row.rowIndex}
                        className={cn(isExcluded && 'text-muted-foreground')}
                        data-excluded={isExcluded ? 'true' : undefined}
                      >
                        <TableCell
                          className={cn(
                            'whitespace-nowrap text-sm',
                            isExcluded && 'line-through',
                          )}
                        >
                          {row.occurredAt ?? '—'}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'max-w-[200px] truncate text-sm',
                            isExcluded && 'line-through',
                          )}
                        >
                          {row.description}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right text-sm tabular-nums',
                            isExcluded && 'line-through',
                          )}
                        >
                          {row.amount != null ? (
                            <span className={Number(row.amount) < 0 ? 'text-destructive' : 'text-green-600'}>
                              {(Number(row.amount) < 0 ? '−' : '+') + ' ' + formatAbsoluteAmount(row.amount)}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                {isExcluded ? (
                                  <Badge variant="outline" className="cursor-pointer">
                                    Esclusa
                                  </Badge>
                                ) : row.duplicate ? (
                                  <Badge variant="secondary" className="cursor-pointer">
                                    Duplicato
                                  </Badge>
                                ) : row.valid ? (
                                  <Badge variant="default" className="cursor-pointer">
                                    Valida
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="cursor-pointer">
                                    Errore
                                  </Badge>
                                )}
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {isExcluded ? (
                                  <DropdownMenuItem onSelect={() => restoreRow(row.rowIndex)}>
                                    Ripristina
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onSelect={() => excludeRow(row.rowIndex)}>
                                    Non importare
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {!isExcluded && row.warnings.length > 0 && (
                              <Badge variant="outline">Avviso</Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {filteredRows.length > PREVIEW_COLLAPSED_COUNT && (
              <div className="px-6 pb-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? 'Mostra meno' : `Mostra tutte (${filteredRows.length})`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirm button — hidden when analysis has fatal errors.
          Sticky to the viewport bottom so it stays reachable while the expanded
          row list scrolls, without jumping to the end of a long import. */}
      {!hasErrors && !confirmDisabledReason && (
        <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t bg-background/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {error && (
            <Alert variant="destructive" role="alert">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && discoveryCount === null && (
            <Alert role="status">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>Importazione completata. Reindirizzamento…</AlertDescription>
            </Alert>
          )}

          {success && discoveryCount !== null && discoveryCount > 0 && importedFileId && (
            <Alert role="status">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="flex flex-col gap-2">
                  <span>Importazione completata.</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button asChild size="sm" variant="default">
                      <a href={`/import/${encodeURIComponent(importedFileId)}/suggestions`}>
                        <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                        {discoveryCount === 1
                          ? '1 pattern proposto — Rivedi suggerimenti'
                          : `${discoveryCount} pattern proposti — Rivedi suggerimenti`}
                      </a>
                    </Button>
                    <button
                      type="button"
                      onClick={() => router.push(APP_ROUTES.expenses)}
                      className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Vai alle spese
                    </button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {success && discoveryCount === 0 && (
            <Alert role="status">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>Importazione completata. Reindirizzamento…</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleConfirm}
            disabled={isPending || success}
            aria-busy={isPending}
            className="self-start"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {hasWarnings ? 'Conferma importazione (con avvisi)' : 'Conferma importazione'}
          </Button>
        </div>
      )}
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
    </div>
  )
}
