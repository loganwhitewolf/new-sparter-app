import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ImportFormatWizard } from '@/components/import/import-format-wizard'
import { loadImportFormatWizardContextAction } from '@/lib/actions/import'
import { APP_ROUTES } from '@/lib/routes'

export default async function ConfigureImportFormatPage({
  params,
}: {
  params: Promise<{ fileId: string }>
}) {
  const { fileId } = await params
  const formData = new FormData()
  formData.set('fileId', fileId)
  const result = await loadImportFormatWizardContextAction(formData)

  if (result.error || !result.data) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold">Configura formato importazione</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Non è stato possibile preparare la configurazione del formato.
          </p>
        </div>
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Formato non configurabile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive" role="alert">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                {result.error ?? 'Impossibile leggere le intestazioni del file. Riprova.'}
              </AlertDescription>
            </Alert>
            <Button asChild variant="outline">
              <Link href={APP_ROUTES.import}>Torna alle importazioni</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Configura formato importazione</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Completa il formato privato e riprova l’analisi dello stesso file.
        </p>
      </div>

      <ImportFormatWizard context={result.data} />
    </div>
  )
}
