'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
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

function CategorySidebar({
  categories,
  selectedId,
  onSelect,
}: {
  categories: CategoryWithSubCategories[]
  selectedId: number | null
  onSelect: (id: number) => void
}) {
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    items: categories.filter((c) => c.type === type),
  })).filter((g) => g.items.length > 0)

  return (
    <nav className="flex flex-col gap-4" aria-label="Categorie">
      {grouped.map(({ type, label, items }) => (
        <div key={type} className="flex flex-col gap-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          {items.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id)}
              className={cn(
                'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                selectedId === cat.id && 'bg-accent text-accent-foreground font-medium',
              )}
              aria-current={selectedId === cat.id ? 'true' : undefined}
            >
              <span className="truncate">{cat.name}</span>
              {cat.isOwned && (
                <Badge variant="secondary" className="ml-2 shrink-0 text-[10px]">Personale</Badge>
              )}
            </button>
          ))}
        </div>
      ))}
    </nav>
  )
}

function SubcategoryList({ category }: { category: CategoryWithSubCategories }) {
  return (
    <section aria-labelledby="subcategory-list-heading">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 id="subcategory-list-heading" className="text-lg font-semibold">{category.name}</h3>
            {category.isOwned
              ? <Badge variant="secondary">Personale</Badge>
              : <Badge variant="outline">Sistema</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {category.type === 'system'
              ? 'Categoria condivisa: puoi personalizzare solo il nome delle sottocategorie.'
              : 'Categoria personale: puoi rinominare, aggiungere sottocategorie e, se non ci sono spese collegate, eliminarla.'}
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

      <div className="flex flex-col gap-2">
        {category.subCategories.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Nessuna sottocategoria visibile per questa categoria.
          </p>
        ) : (
          category.subCategories.map((subCategory) => (
            <div
              key={subCategory.id}
              className="flex items-start justify-between gap-3 rounded-md bg-muted/40 px-4 py-3"
              data-testid={`subcategory-row-${subCategory.id}`}
              aria-label={`Sottocategoria ${subCategory.name}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm">{subCategory.name}</span>
                  {subCategory.isOwned
                    ? <Badge variant="secondary" className="text-[10px]">Personale</Badge>
                    : <Badge variant="outline" className="text-[10px]">Sistema</Badge>}
                </div>
                {subCategory.hasOverride ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nome originale: {subCategory.originalName}. Questo nome vale solo per te.
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
    </section>
  )
}

export function CategorySettingsPanel({ categories }: CategorySettingsPanelProps) {
  const [selectedId, setSelectedId] = useState<number | null>(
    categories.length > 0 ? categories[0].id : null,
  )

  const selectedCategory = categories.find((c) => c.id === selectedId) ?? null

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Gestione categorie</CardTitle>
          <CardDescription>
            Seleziona una categoria per visualizzare e modificare le sue sottocategorie.
          </CardDescription>
        </div>
        <CreateCategoryDialog />
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nessuna categoria disponibile.
          </div>
        ) : (
          <div className="grid grid-cols-[200px_1fr] gap-6 min-h-[300px]">
            <div className="border-r pr-4">
              <CategorySidebar
                categories={categories}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
            <div className="min-w-0">
              {selectedCategory ? (
                <SubcategoryList category={selectedCategory} />
              ) : (
                <p className="text-sm text-muted-foreground">Seleziona una categoria dalla lista.</p>
              )}
            </div>
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground border-t pt-3">
          Le eliminazioni sono disponibili solo per voci personali. Le sottocategorie collegate a spese vengono bloccate per proteggere lo storico.
        </p>
      </CardContent>
    </Card>
  )
}
