import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ImportPreview } from '@/components/import/import-preview'
import { analyzeImportAction } from '@/lib/actions/import'
import type { ImportAnalysisResult } from '@/lib/services/import'

const UNKNOWN_FORMAT_ERROR = 'No supported import format matched'

function isUnknownFormatAnalysis(result: ImportAnalysisResult) {
  return result.formatVersionId === null && result.errors.some((error) => error.includes(UNKNOWN_FORMAT_ERROR))
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function displayAnalysisError(error: string) {
  if (error.includes('Could not read') || error.includes('Could not parse')) {
    return 'Impossibile leggere il file caricato. Riprova.'
  }

  return error
}

export default async function AnalyzePage({
  params,
  searchParams,
}: {
  params: Promise<{ fileId: string }>
  searchParams?: Promise<{ formatVersionId?: string | string[] }>
}) {
  const { fileId } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const selectedFormatVersionId = firstSearchParam(resolvedSearchParams.formatVersionId)

  const fd = new FormData()
  fd.set('fileId', fileId)
  if (selectedFormatVersionId) {
    fd.set('selectedFormatVersionId', selectedFormatVersionId)
  }

  const result = await analyzeImportAction(fd)

  if (result.error && !result.data) {
    if (result.error.includes('not found') || result.error.includes('access denied')) {
      notFound()
    }

    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold">Analisi file</h1>
        </div>
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Errore di analisi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{displayAnalysisError(result.error)}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!result.data) {
    notFound()
  }

  const isUnknownFormat = Boolean(result.data && isUnknownFormatAnalysis(result.data))
  const previewResult = isUnknownFormat
    ? {
        ...result.data,
        errors: ['Formato non riconosciuto. Configura un formato privato per riprovare l’analisi.'],
      }
    : result.data

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Analisi file</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verifica i dettagli prima di confermare l&apos;importazione
        </p>
      </div>

      {isUnknownFormat && (
        <Card className="max-w-2xl border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardTitle>Formato non riconosciuto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                Il file è leggibile, ma non corrisponde ai formati disponibili. Puoi creare un
                formato privato usando le intestazioni del file e riprovare subito l&apos;analisi.
              </AlertDescription>
            </Alert>
            <Button asChild>
              <Link href={`/import/${encodeURIComponent(fileId)}/configure`}>
                Configura formato privato
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <ImportPreview result={previewResult} />
    </div>
  )
}
