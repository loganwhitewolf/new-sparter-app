import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ImportUploader } from '@/components/import/import-uploader'
import { MAX_IMPORT_FILE_SIZE_BYTES } from '@/lib/validations/import'

const MAX_MB = Math.round(MAX_IMPORT_FILE_SIZE_BYTES / (1024 * 1024))

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Importa file bancario</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Carica un estratto conto per aggiungere le tue transazioni
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Carica file</CardTitle>
          <CardDescription>
            Formati supportati: <strong>.csv</strong>, <strong>.xlsx</strong> — dimensione massima{' '}
            <strong>{MAX_MB} MB</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportUploader />
        </CardContent>
      </Card>
    </div>
  )
}
