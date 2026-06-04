import { DataTableToolbar } from '@/components/data-table/DataTableToolbar'
import { ImportTable } from '@/components/import/import-table'
import { ImportUploadDialog } from '@/components/import/import-upload-dialog'
import { getImports, IMPORT_LIST_LIMIT, type ImportListRow } from '@/lib/dal/imports'
import { getMonthsWithData } from '@/lib/dal/months-with-data'
import { getTransactionPlatforms } from '@/lib/dal/transactions'
import { parseImportFilters, type ImportSearchParams } from '@/lib/validations/import'
import { filesTableConfig } from '@/app/(app)/import/files.table'
import { APP_ROUTES } from '@/lib/routes'

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
    // Wave 4: new filter keys
    platform: filters.platform ?? '',
    statusBucket: filters.statusBucket ?? '',
    months: (filters.months ?? []).join(','),
    amountMin: filters.amountMin ?? '',
    amountMax: filters.amountMax ?? '',
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
    [imports] = await Promise.all([
      getImports(filters, { limit: IMPORT_LIST_LIMIT }),
    ])
  } catch (error) {
    if (isNextNavigationError(error)) {
      throw error
    }

    importHistoryLoadError = true
  }

  const [platforms, monthsWithData] = await Promise.all([
    getTransactionPlatforms(),
    getMonthsWithData('files'),
  ])

  const platformOptions = platforms.map((p) => ({ value: p.slug, label: p.name }))

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
        <DataTableToolbar
          config={filesTableConfig}
          route={APP_ROUTES.import}
          monthsWithData={monthsWithData}
          filterOptions={{ platform: platformOptions }}
        />
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
