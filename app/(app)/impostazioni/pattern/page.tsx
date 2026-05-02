import { verifySession } from '@/lib/dal/auth'
import { getUserPatterns } from '@/lib/dal/patterns'
import { getCategories } from '@/lib/dal/categories'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { PatternActions } from '@/components/patterns/pattern-actions'
import { CreatePatternDialog } from '@/components/patterns/create-pattern-dialog'

export const metadata = { title: 'Pattern personalizzati' }

export default async function PatternPage() {
  const { userId, subscriptionPlan } = await verifySession()
  const isPaid = subscriptionPlan === 'basic' || subscriptionPlan === 'pro'

  const [allPatterns, categories] = await Promise.all([
    getUserPatterns(userId),
    getCategories(),
  ])

  // Only show user-owned patterns on this page (system patterns not editable)
  const userPatterns = allPatterns.filter((p) => p.userId !== null)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pattern personalizzati</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Regole regex per la categorizzazione automatica delle transazioni.
          </p>
        </div>
        {isPaid ? (
          <CreatePatternDialog categories={categories} />
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Disponibile con piano Basic o Pro.
          </div>
        )}
      </div>

      {userPatterns.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {isPaid
            ? 'Nessun pattern personalizzato. Crea il primo pattern per iniziare.'
            : 'Aggiorna il tuo piano per creare pattern personalizzati.'}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pattern (regex)</TableHead>
              <TableHead>Segno</TableHead>
              <TableHead>Confidenza</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {userPatterns.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.pattern}</TableCell>
                <TableCell>
                  <Badge variant="outline">{p.amountSign}</Badge>
                </TableCell>
                <TableCell>{(parseFloat(p.confidence) * 100).toFixed(0)}%</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.description ?? '—'}
                </TableCell>
                <TableCell>
                  <PatternActions
                    id={p.id}
                    pattern={p.pattern}
                    subCategoryId={p.subCategoryId}
                    amountSign={p.amountSign}
                    confidence={p.confidence}
                    description={p.description}
                    categories={categories}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
