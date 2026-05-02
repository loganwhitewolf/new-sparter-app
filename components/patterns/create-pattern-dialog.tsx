'use client'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createPatternAction } from '@/lib/actions/patterns'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'

type Props = {
  categories: CategoryWithSubCategories[]
}

export function CreatePatternDialog({ categories }: Props) {
  const [open, setOpen] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [subCategoryId, setSubCategoryId] = useState('')
  const [amountSign, setAmountSign] = useState<'positive' | 'negative' | 'any'>('negative')
  const [confidence, setConfidence] = useState('0.85')
  const [state, formAction, isPending] = useActionState(createPatternAction, { error: null })
  const submittedRef = useRef(false)

  const selectedCategory = useMemo(
    () => categories.find((category) => String(category.id) === categoryId),
    [categories, categoryId],
  )

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      toast.success('Pattern creato con successo.')
      submittedRef.current = false
      setOpen(false)
      setCategoryId('')
      setSubCategoryId('')
      setAmountSign('negative')
      setConfidence('0.85')
    }
  }, [state])

  function handleCategoryChange(value: string) {
    setCategoryId(value)
    setSubCategoryId('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Nuovo pattern
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuovo pattern personalizzato</DialogTitle>
          <DialogDescription>
            Crea una regola regex da applicare prima dei pattern di sistema.
          </DialogDescription>
        </DialogHeader>

        <form
          action={(formData) => {
            submittedRef.current = true
            formAction(formData)
          }}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="subCategoryId" value={subCategoryId} />
          <input type="hidden" name="amountSign" value={amountSign} />
          <input type="hidden" name="confidence" value={confidence} />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="pattern-regex">
              Pattern regex <span className="text-destructive">*</span>
            </label>
            <Input
              id="pattern-regex"
              name="pattern"
              placeholder="es. (?:\\bmercato locale\\b|\\bpanificio rossi\\b)"
              required
            />
            <p className="text-xs text-muted-foreground">
              La regex viene valutata senza distinzione tra maiuscole e minuscole.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Categoria</label>
              <Select value={categoryId} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Sottocategoria</label>
              <Select
                value={subCategoryId}
                onValueChange={setSubCategoryId}
                disabled={!selectedCategory}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sottocategoria" />
                </SelectTrigger>
                <SelectContent>
                  {selectedCategory?.subCategories.map((subCategory) => (
                    <SelectItem key={subCategory.id} value={String(subCategory.id)}>
                      {subCategory.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Segno importo</label>
              <Select value={amountSign} onValueChange={(value) => setAmountSign(value as typeof amountSign)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="negative">Uscite</SelectItem>
                  <SelectItem value="positive">Entrate</SelectItem>
                  <SelectItem value="any">Qualsiasi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="pattern-confidence">
                Confidenza
              </label>
              <Input
                id="pattern-confidence"
                inputMode="decimal"
                min="0"
                max="1"
                step="0.01"
                type="number"
                value={confidence}
                onChange={(event) => setConfidence(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="pattern-description">
              Descrizione
            </label>
            <Input id="pattern-description" name="description" placeholder="es. Negozio sotto casa" />
          </div>

          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Annulla
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending || !subCategoryId || !confidence}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crea pattern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
