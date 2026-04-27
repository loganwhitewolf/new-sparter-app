'use client'
import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { deleteExpense } from '@/lib/actions/expenses'
import { BulkActionBar } from './bulk-action-bar'
import { BulkCategorizeDialog } from './bulk-categorize-dialog'
import { ExpenseFormDialog } from './expense-form-dialog'
import type { ExpenseRow } from '@/lib/dal/expenses'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import { cn } from '@/lib/utils'

type Props = {
  expenses: ExpenseRow[]
  categories: CategoryWithSubCategories[]
}

export function ExpenseTable({ expenses, categories }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)

  const allSelected = expenses.length > 0 && selectedIds.length === expenses.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < expenses.length

  function toggleAll() {
    setSelectedIds(allSelected ? [] : expenses.map((e) => e.id))
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date))
  }

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-base font-medium text-foreground">Nessuna spesa trovata</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Non hai ancora aggiunto spese. Clicca su &ldquo;Nuova spesa&rdquo; per iniziare.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary">
              <TableHead className="w-10 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected
                  }}
                  onChange={toggleAll}
                  className="h-4 w-4 cursor-pointer"
                  aria-label="Seleziona tutte le spese"
                />
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-normal">
                Titolo
              </TableHead>
              <TableHead className="w-44 text-xs uppercase tracking-wide text-muted-foreground font-normal">
                Categoria
              </TableHead>
              <TableHead className="w-36 text-center text-xs uppercase tracking-wide text-muted-foreground font-normal">
                Stato
              </TableHead>
              <TableHead className="w-24 text-right text-xs uppercase tracking-wide text-muted-foreground font-normal">
                Data
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((exp) => {
              const isSelected = selectedIds.includes(exp.id)
              const isCategorized = exp.status === '2' || exp.status === '3'
              const categoryLabel =
                exp.categoryName && exp.subCategoryName
                  ? `${exp.categoryName} · ${exp.subCategoryName}`
                  : '—'

              return (
                <TableRow
                  key={exp.id}
                  className={cn(
                    'h-11 hover:bg-muted/50 transition-colors',
                    isSelected && 'bg-primary/5'
                  )}
                >
                  <TableCell className="w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(exp.id)}
                      className="h-4 w-4 cursor-pointer"
                      aria-label={`Seleziona ${exp.title}`}
                    />
                  </TableCell>
                  <TableCell>
                    <span
                      className="font-mono text-sm tracking-tight truncate block max-w-[280px]"
                      title={exp.title}
                    >
                      {exp.title}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{categoryLabel}</TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={cn(
                        'border-0',
                        isCategorized
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      )}
                    >
                      {isCategorized ? 'Categorizzata' : 'Da categorizzare'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-sm">
                    {formatDate(exp.createdAt)}
                  </TableCell>
                  <TableCell className="w-10 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={`Azioni per ${exp.title}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <ExpenseFormDialog
                          categories={categories}
                          mode="edit"
                          expense={exp}
                          trigger={
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              Modifica
                            </DropdownMenuItem>
                          }
                        />
                        <DeleteExpenseMenuItem
                          expense={exp}
                          onDeleted={() => {
                            setSelectedIds((prev) => prev.filter((id) => id !== exp.id))
                          }}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <BulkActionBar
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
        onBulkCategorize={() => setBulkDialogOpen(true)}
      />

      <BulkCategorizeDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        selectedIds={selectedIds}
        categories={categories}
        onSuccess={() => {
          setSelectedIds([])
          setBulkDialogOpen(false)
        }}
      />
    </>
  )
}

function DeleteExpenseMenuItem({
  expense,
  onDeleted,
}: {
  expense: ExpenseRow
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleDelete() {
    setPending(true)
    const fd = new FormData()
    fd.set('id', expense.id)
    const result = await deleteExpense({ error: null }, fd)
    setPending(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Spesa eliminata.')
      onDeleted()
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          className="text-destructive focus:text-destructive"
        >
          Elimina
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Elimina spesa</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Sei sicuro di voler eliminare &ldquo;{expense.title}&rdquo;? Questa azione non
          può essere annullata.
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Annulla</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            Elimina
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
