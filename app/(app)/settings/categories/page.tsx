import { verifySession } from '@/lib/dal/auth'
import { getCategories } from '@/lib/dal/categories'
import { CategorySettingsPanel } from '@/components/categories/category-settings-panel'

export const metadata = { title: 'Categorie' }

export default async function CategoriesPage() {
  await verifySession()

  const categories = await getCategories()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categorie</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestisci la tua tassonomia personale: categorie e sottocategorie di entrate e uscite.
        </p>
      </div>

      <CategorySettingsPanel categories={categories} />
    </div>
  )
}
