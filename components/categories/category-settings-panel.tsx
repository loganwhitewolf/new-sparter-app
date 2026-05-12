import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import {
  CreateCategoryDialog,
  CreateSubcategoryDialog,
  DeleteCategoryDialog,
  DeleteSubcategoryDialog,
  RenameCategoryDialog,
  RenameSubcategoryDialog,
} from './category-mutation-dialogs'

type CategorySettingsPanelProps = {
  categories: CategoryWithSubCategories[]
}

const TYPE_LABELS: Record<CategoryWithSubCategories['type'], string> = {
  in: 'Entrate',
  out: 'Uscite',
  system: 'Sistema',
}

const TYPE_ORDER: CategoryWithSubCategories['type'][] = ['out', 'in', 'system']

function CategoryTypeSection({ type, categories }: {
  type: CategoryWithSubCategories['type']
  categories: CategoryWithSubCategories[]
}) {
  if (categories.length === 0) return null

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`category-type-${type}`}>
      <div className="flex items-center justify-between gap-3 border-b pb-2">
        <div>
          <h3 id={`category-type-${type}`} className="text-lg font-semibold">{TYPE_LABELS[type]}</h3>
          <p className="text-sm text-muted-foreground">
            {type === 'system'
              ? 'Categorie condivise: puoi personalizzare solo il nome delle sottocategorie.'
              : 'Categorie disponibili per le tue transazioni.'}
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {categories.map((category) => (
          <article
            key={category.id}
            className="rounded-lg border p-4"
            data-testid={`category-row-${category.id}`}
            aria-label={`Categoria ${category.name}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-medium">{category.name}</h4>
                  {category.isOwned && <Badge variant="secondary">Personale</Badge>}
                  {!category.isOwned && <Badge variant="outline">Sistema</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {category.isOwned
                    ? 'Categoria personale modificabile.'
                    : 'Categoria di sistema: rinomina ed eliminazione non disponibili.'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <CreateSubcategoryDialog category={category} />
                {category.isOwned && (
                  <>
                    <RenameCategoryDialog category={category} />
                    <DeleteCategoryDialog category={category} />
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {category.subCategories.length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Nessuna sottocategoria visibile.
                </p>
              ) : (
                category.subCategories.map((subCategory) => (
                  <div
                    key={subCategory.id}
                    className="flex items-start justify-between gap-3 rounded-md bg-muted/40 p-3"
                    data-testid={`subcategory-row-${subCategory.id}`}
                    aria-label={`Sottocategoria ${subCategory.name}`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{subCategory.name}</span>
                        {subCategory.isOwned && <Badge variant="secondary">Personale</Badge>}
                        {!subCategory.isOwned && <Badge variant="outline">Sistema</Badge>}
                      </div>
                      {subCategory.hasOverride ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Nome originale: {subCategory.originalName}. Questo nome personalizzato vale solo per te.
                        </p>
                      ) : !subCategory.isOwned ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Puoi creare un nome personale senza modificare la tassonomia di sistema.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <RenameSubcategoryDialog subCategory={subCategory} />
                      {subCategory.isOwned && <DeleteSubcategoryDialog subCategory={subCategory} />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function CategorySettingsPanel({ categories }: CategorySettingsPanelProps) {
  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Gestione categorie</CardTitle>
          <CardDescription>
            Crea categorie personali, rinomina le tue voci e personalizza i nomi delle sottocategorie di sistema.
          </CardDescription>
        </div>
        <CreateCategoryDialog />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Le eliminazioni sono disponibili solo per voci personali. Le sottocategorie collegate a spese vengono bloccate per proteggere lo storico.
        </div>
        {categories.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nessuna categoria disponibile.
          </div>
        ) : (
          TYPE_ORDER.map((type) => (
            <CategoryTypeSection
              key={type}
              type={type}
              categories={categories.filter((category) => category.type === type)}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}
