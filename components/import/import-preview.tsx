'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

type FormatCandidate = {
  formatVersionId: number
  platformName: string
  confidence: number
}

type Props = {
  result: ImportAnalysisResult
  candidates?: FormatCandidate[]
}

export function ImportPreview({ result, candidates = [] }: Props) {
  const router = useRouter()
  const [selectedFormatVersionId, setSelectedFormatVersionId] = useState<string>(
    result.formatVersionId ? String(result.formatVersionId) : '',
  )
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const submitLock = useRef(false)

  const hasErrors = result.errors.length > 0
  const hasWarnings = result.warnings.length > 0

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

    try {
      const res = await confirmImportAction(fd)
      if (res.error) {
        setError(res.error)
        submitLock.current = false
        setIsPending(false)
        return
      }
      setSuccess(true)
      router.push('/spese')
    } catch {
      setError('Importazione fallita. Riprova.')
      submitLock.current = false
      setIsPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryTile label="Righe trovate" value={String(result.rowCount)} />
        <SummaryTile label="Duplicati" value={String(result.duplicateCount)} />
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
          <CardContent className="p-0">
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
                  {result.sampleRows.map((row) => (
                    <TableRow key={row.rowIndex}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {row.occurredAt ?? '—'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {row.description}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {row.amount ?? '—'}
                      </TableCell>
                      <TableCell>
                        {row.duplicate ? (
                          <Badge variant="secondary">Duplicato</Badge>
                        ) : row.valid ? (
                          <Badge variant="default">Valida</Badge>
                        ) : (
                          <Badge variant="destructive">Errore</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm button — hidden when analysis has fatal errors */}
      {!hasErrors && (
        <div className="flex flex-col gap-3">
          {error && (
            <Alert variant="destructive" role="alert">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
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
