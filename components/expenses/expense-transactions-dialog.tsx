'use client'
import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Building2, ExternalLink, FileText, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchExpenseTransactions } from '@/lib/actions/expenses'
import type { ExpenseSourceFile } from '@/lib/dal/expenses'
import type { ExpenseTransactionRow } from '@/lib/dal/transactions'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense: { id: string; title: string }
}

export function ExpenseTransactionsDialog({ open, onOpenChange, expense }: Props) {
  const [transactions, setTransactions] = useState<ExpenseTransactionRow[]>([])
  const [sourceFile, setSourceFile] = useState<ExpenseSourceFile | null>(null)
  const [platformName, setPlatformName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open || !expense.id) return

    setTransactions([])
    setSourceFile(null)
    setPlatformName(null)
    setError(null)

    startTransition(async () => {
      const result = await fetchExpenseTransactions(expense.id)
      if (result.error) {
        setError(result.error)
      } else {
        setTransactions(result.transactions)
        setSourceFile(result.sourceFile)
        setPlatformName(result.platformName)
      }
    })
  }, [open, expense.id])

  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date))
  }

  function formatAmount(amount: string, currency: string): string {
    const num = parseFloat(amount)
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency,
    }).format(num)
  }

  function handleSearchOnline() {
    const query = encodeURIComponent(expense.title)
    window.open(`https://www.google.com/search?q=${query}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg flex flex-col max-h-[85vh]">
        <DialogHeader className="pr-8 shrink-0">
          <DialogTitle className="break-words">{expense.title}</DialogTitle>
          <DialogDescription>
            Dettagli della spesa e transazioni collegate
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
          {(platformName || sourceFile) && !isPending && !error ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2.5 text-sm space-y-3">
              {platformName ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Piattaforma
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1.5 font-medium text-foreground">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {platformName}
                  </p>
                </div>
              ) : null}
              {sourceFile ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    File di origine
                  </p>
                  <Link
                    href={`/import?q=${encodeURIComponent(sourceFile.name)}`}
                    className="mt-1 inline-flex items-center gap-1.5 font-medium text-foreground hover:underline"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="break-all">{sourceFile.name}</span>
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}

          {isPending ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-center text-sm text-destructive py-4">{error}</p>
          ) : transactions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              Nessuna transazione collegata.
            </p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/70">
                    <TableHead className="w-10 text-xs uppercase tracking-wide text-muted-foreground font-normal">
                      #
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-normal">
                      Descrizione
                    </TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground font-normal">
                      Importo
                    </TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground font-normal">
                      Data
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx, index) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm text-muted-foreground align-top">
                        {index + 1}
                      </TableCell>
                      <TableCell className="text-sm whitespace-normal break-words align-top">
                        {tx.description}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-sm whitespace-nowrap align-top">
                        {formatAmount(tx.amount, tx.currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-sm whitespace-nowrap align-top">
                        {formatDate(tx.occurredAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Button onClick={handleSearchOnline} className="shrink-0">
            <ExternalLink className="h-4 w-4" />
            Cerca su internet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
