import { verifySession } from '@/lib/dal/auth'
import { getCategories } from '@/lib/dal/categories'
import { getUserPatterns } from '@/lib/dal/patterns'
import { CategoryPatternPanel } from '@/components/categories/category-pattern-panel'
import { CategorySettingsPanel } from '@/components/categories/category-settings-panel'

export const metadata = { title: 'Categorie' }

export default async function CategoriesPage() {
  const { userId, subscriptionPlan } = await verifySession()
  const isPaid = subscriptionPlan === 'basic' || subscriptionPlan === 'pro'

  const [categories, allPatterns] = await Promise.all([
    getCategories(),
    getUserPatterns(userId),
  ])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categorie</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestisci la tua tassonomia personale e assegna pattern di categorizzazione dalla stessa pagina.
        </p>
      </div>

      <CategorySettingsPanel categories={categories} />

      <CategoryPatternPanel
        categories={categories}
        patterns={allPatterns}
        isPaid={isPaid}
        heading="Pattern di categorizzazione"
        description="Crea e modifica i pattern personalizzati usando le categorie caricate qui sopra."
        emptyPaidMessage="Nessun pattern personalizzato collegato alle tue categorie."
        emptyFreeMessage="Aggiorna il tuo piano per creare pattern personalizzati da questa pagina."
      />
    </div>
  )
}
