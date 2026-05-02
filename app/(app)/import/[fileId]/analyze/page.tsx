import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ImportPreview } from '@/components/import/import-preview'
import { analyzeImportAction } from '@/lib/actions/import'

export default async function AnalyzePage({
  params,
}: {
  params: Promise<{ fileId: string }>
}) {
  const { fileId } = await params

  const fd = new FormData()
  fd.set('fileId', fileId)

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
            <p className="text-sm text-destructive">{result.error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!result.data) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Analisi file</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verifica i dettagli prima di confermare l&apos;importazione
        </p>
      </div>

      <ImportPreview result={result.data} />
    </div>
  )
}
