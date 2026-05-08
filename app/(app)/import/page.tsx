import { ImportFilters } from '@/components/import/import-filters'
import { ImportTable } from '@/components/import/import-table'
import { ImportUploadDialog } from '@/components/import/import-upload-dialog'
import { getImports, IMPORT_LIST_LIMIT, type ImportListRow } from '@/lib/dal/imports'
import { parseImportFilters, type ImportSearchParams } from '@/lib/validations/import'

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Importazioni</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Storico dei file bancari caricati
          </p>
        </div>
        <ImportUploadDialog />
      </div>

      <section className="flex flex-col gap-3">
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
