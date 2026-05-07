import { ImportFilters } from '@/components/import/import-filters'
import { ImportTable } from '@/components/import/import-table'
import { ImportUploader } from '@/components/import/import-uploader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getImports, IMPORT_LIST_LIMIT, type ImportListRow } from '@/lib/dal/imports'
import { parseImportFilters, MAX_IMPORT_FILE_SIZE_BYTES, type ImportSearchParams } from '@/lib/validations/import'

const MAX_MB = Math.round(MAX_IMPORT_FILE_SIZE_BYTES / (1024 * 1024))

function isNextNavigationError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const digest = 'digest' in error ? String((error as { digest?: unknown }).digest) : ''
  return digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_HTTP_ERROR_FALLBACK')
}

function getFilterKey(filters: ReturnType<typeof parseImportFilters>) {
  return JSON.stringify({
    q: filters.q ?? '',
    importedFrom: filters.importedFrom ?? '',
    importedTo: filters.importedTo ?? '',
    referenceFrom: filters.referenceFrom ?? '',
    referenceTo: filters.referenceTo ?? '',
  })
}

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<ImportSearchParams>
}) {
  const rawSearchParams = await searchParams
  const filters = parseImportFilters(rawSearchParams)
  const filterKey = getFilterKey(filters)
  let imports: ImportListRow[] = []
  let importHistoryLoadError = false

  try {
    imports = await getImports(filters, { limit: IMPORT_LIST_LIMIT })
  } catch (error) {
    if (isNextNavigationError(error)) {
      throw error
    }

    importHistoryLoadError = true
  }

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

      <section className="flex flex-col gap-3" aria-labelledby="import-history-heading">
        <div>
          <h2 id="import-history-heading" className="text-lg font-semibold">
            Storico importazioni
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Controlla stato, statistiche e messaggi sicuri degli ultimi file caricati.
          </p>
        </div>
        <ImportFilters filters={filters} />
        <ImportTable
          key={filterKey}
          imports={imports}
          loadError={importHistoryLoadError}
          filters={filters}
          searchParams={rawSearchParams}
        />
      </section>
    </div>
  )
}
