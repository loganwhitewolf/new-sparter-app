import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CreatePatternDialog } from '@/components/patterns/create-pattern-dialog'
import { PatternActions } from '@/components/patterns/pattern-actions'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { PatternRow } from '@/lib/dal/patterns'

export function buildDestinationLabels(categories: CategoryWithSubCategories[]) {
  const labels = new Map<number, string>()

  for (const category of categories) {
    for (const subCategory of category.subCategories) {
      labels.set(subCategory.id, `${category.name} → ${subCategory.name}`)
    }
  }

  return labels
}

export function getDestinationLabel(destinationLabels: Map<number, string>, subCategoryId: number) {
  return destinationLabels.get(subCategoryId) ?? `Sottocategoria non trovata (#${subCategoryId})`
}

type CategoryPatternPanelProps = {
  categories: CategoryWithSubCategories[]
  patterns: PatternRow[]
  isPaid: boolean
  heading?: string
  description?: string
  emptyPaidMessage?: string
  emptyFreeMessage?: string
  wrapInCard?: boolean
  action?: ReactNode
}

export function CategoryPatternPanel({
  categories,
  patterns,
  isPaid,
  heading = 'Pattern personalizzati',
  description = 'Regole regex per la categorizzazione automatica delle transazioni.',
  emptyPaidMessage = 'Nessun pattern personalizzato. Crea il primo pattern per iniziare.',
  emptyFreeMessage = 'Aggiorna il tuo piano per creare pattern personalizzati.',
  wrapInCard = true,
  action,
}: CategoryPatternPanelProps) {
  const userPatterns = patterns.filter((pattern) => pattern.userId !== null)
  const destinationLabels = buildDestinationLabels(categories)
  const resolvedAction = action ?? (
    isPaid ? (
      <CreatePatternDialog categories={categories} />
    ) : (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
        Disponibile con piano Basic o Pro.
      </div>
    )
  )

  const listContent = (
    <>
      {userPatterns.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {isPaid ? emptyPaidMessage : emptyFreeMessage}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pattern (regex)</TableHead>
              <TableHead>Destinazione</TableHead>
              <TableHead>Segno</TableHead>
              <TableHead>Confidenza</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {userPatterns.map((pattern) => (
              <TableRow key={pattern.id}>
                <TableCell className="font-mono text-xs">{pattern.pattern}</TableCell>
                <TableCell className="text-sm">
                  {getDestinationLabel(destinationLabels, pattern.subCategoryId)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{pattern.amountSign}</Badge>
                </TableCell>
                <TableCell>{(parseFloat(pattern.confidence) * 100).toFixed(0)}%</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {pattern.description ?? '—'}
                </TableCell>
                <TableCell>
                  <PatternActions
                    id={pattern.id}
                    pattern={pattern.pattern}
                    subCategoryId={pattern.subCategoryId}
                    amountSign={pattern.amountSign}
                    confidence={pattern.confidence}
                    description={pattern.description}
                    categories={categories}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )

  if (!wrapInCard) {
    return (
      <section className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{heading}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          {resolvedAction}
        </div>
        {listContent}
      </section>
    )
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>{heading}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {resolvedAction}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">{listContent}</CardContent>
    </Card>
  )
}
