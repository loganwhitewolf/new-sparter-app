import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCategories } from '@/lib/dal/categories'
import { getMostUsedSubcategories } from '@/lib/dal/subcategory-usage'
import { getTopExpensesForOnboarding } from '@/lib/dal/transactions'
import { APP_ROUTES } from '@/lib/routes'
import { SubcategoryCombobox } from '@/app/(app)/onboarding/_components/subcategory-combobox'

type Step4CategorizeProps = {
  userId: string
}

export async function Step4Categorize({ userId }: Step4CategorizeProps) {
  const [expenses, categories, mostUsed] = await Promise.all([
    // Stable top-15: categorized rows are included so a row never vanishes after save
    // or refresh; already-categorized rows render with a persistent green check.
    getTopExpensesForOnboarding(userId, 15),
    getCategories(),
    getMostUsedSubcategories(['in', 'out', 'transfer', 'allocation']),
  ])

  // Done-state derives from "no uncategorized remain in the fetched set", NOT from an
  // empty list — the list is intentionally stable so the user keeps seeing their
  // categorized rows (green checks) instead of having them disappear.
  const remaining = expenses.filter((e) => e.subCategoryId === null).length

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] px-4 pt-2 pb-28 text-foreground">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
        <div className="mb-5">
          <h1 className="mb-1 text-2xl font-bold">Categorizza le spese principali</h1>
          <p className="text-sm text-muted-foreground">
            Le 15 con il valore più alto · {remaining} da completare
          </p>
        </div>

        {expenses.length > 0 && remaining > 0 ? (
          <div className="space-y-2 overflow-y-auto">
            {expenses.map((expense) => (
              <SubcategoryCombobox
                key={expense.id}
                expenseId={expense.id}
                expenseTitle={expense.title}
                expenseAmount={expense.totalAmount}
                categories={categories}
                mostUsed={mostUsed}
                initialCategorized={expense.subCategoryId !== null}
                initialSubcategoryName={expense.subCategoryName}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <CheckCircle className="h-7 w-7 text-success" aria-hidden="true" />
              </div>
              <h2 className="mb-2 text-xl font-semibold">Tutto categorizzato!</h2>
              <p className="mb-5 text-sm text-muted-foreground">
                Le spese principali sono pronte per la dashboard.
              </p>
              <Button asChild>
                <Link href={`${APP_ROUTES.onboarding}?step=5`}>Continua</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Step4Categorize
