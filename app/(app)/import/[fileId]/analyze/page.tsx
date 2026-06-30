import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ImportPreview } from '@/components/import/import-preview'
import { analyzeImportAction } from '@/lib/actions/import'
import { ANALYZE_STATUS_ERROR, isUnknownFormatAnalysis } from '@/lib/utils/import-status'

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

    if (result.error === ANALYZE_STATUS_ERROR) {
      redirect(`/import/${encodeURIComponent(fileId)}/suggestions`)
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
            <Button asChild variant="outline" className="mt-4">
              <Link href="/import">Torna alle importazioni</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!result.data) {
    notFound()
  }

  if (isUnknownFormatAnalysis(result.data)) {
    const configureUrl = `/import/${encodeURIComponent(fileId)}/configure${
      from ? `?from=${encodeURIComponent(from)}` : ''
    }`
    redirect(configureUrl)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Analisi file</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verifica i dettagli prima di confermare l&apos;importazione
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/import">Torna alle importazioni</Link>
        </Button>
      </div>

      <ImportPreview
        result={result.data}
        returnTo={from === 'onboarding' ? '/onboarding?step=2' : undefined}
      />
    </div>
  )
}
