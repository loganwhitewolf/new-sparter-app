import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ImportPreview } from '@/components/import/import-preview'
import { analyzeImportAction } from '@/lib/actions/import'
import type { ImportAnalysisResult } from '@/lib/services/import'
import { UNKNOWN_FORMAT_ERROR } from '@/lib/utils/import-status'

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
  searchParams?: Promise<{ formatVersionId?: string | string[], from?: string | string[] }>
}) {
  const { fileId } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const selectedFormatVersionId = firstSearchParam(resolvedSearchParams.formatVersionId)
  const from = firstSearchParam(resolvedSearchParams.from)

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Analisi file</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verifica i dettagli prima di confermare l&apos;importazione
        </p>
      </div>

      {isUnknownFormat && (
        <Card className="max-w-2xl overflow-hidden border-border bg-card shadow-sm">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-400">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Formato file
                </p>
                <CardTitle className="text-lg">Formato non riconosciuto</CardTitle>
                <CardDescription>
                  Il file è leggibile, ma non corrisponde ancora ai formati disponibili.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
              Crea un formato privato usando le intestazioni del file: salveremo la configurazione
              solo per il tuo account e riproveremo subito l&apos;analisi dello stesso documento.
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link href={`/import/${encodeURIComponent(fileId)}/configure${from ? `?from=${encodeURIComponent(from)}` : ''}`}>
                  Configura formato privato
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/import">Torna alle importazioni</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isUnknownFormat && (
        <ImportPreview
          result={result.data}
          returnTo={from === 'onboarding' ? '/onboarding?step=2' : undefined}
        />
      )}
    </div>
  )
}
