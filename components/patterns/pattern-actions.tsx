'use client'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Loader2, Pencil, Trash2 } from 'lucide-react'
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
import { deletePatternAction, updatePatternAction } from '@/lib/actions/patterns'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'

type Props = {
  id: number
  pattern: string
  subCategoryId: number
  amountSign: 'positive' | 'negative' | 'any'
  confidence: string
  description: string | null
  categories: CategoryWithSubCategories[]
}

export function PatternActions({
  id,
  pattern,
  subCategoryId: initialSubCategoryId,
  amountSign: initialAmountSign,
  confidence: initialConfidence,
  description,
  categories,
}: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [subCategoryId, setSubCategoryId] = useState(String(initialSubCategoryId))
  const [amountSign, setAmountSign] = useState(initialAmountSign)
  const [confidence, setConfidence] = useState(initialConfidence)

  const [editState, editAction, isEditPending] = useActionState(updatePatternAction, { error: null })
  const [deleteState, deleteAction, isDeletePending] = useActionState(deletePatternAction, { error: null })
  const editSubmittedRef = useRef(false)
  const deleteSubmittedRef = useRef(false)

  const selectedCategory = useMemo(
    () => categories.find((category) => String(category.id) === categoryId),
    [categories, categoryId],
  )

  useEffect(() => {
    const owningCategoryId = categories.find((category) =>
      category.subCategories.some((subCategory) => subCategory.id === initialSubCategoryId),
    )?.id
    setCategoryId(owningCategoryId ? String(owningCategoryId) : '')
    setSubCategoryId(String(initialSubCategoryId))
    setAmountSign(initialAmountSign)
    setConfidence(initialConfidence)
  }, [categories, initialAmountSign, initialConfidence, initialSubCategoryId, editOpen])

  useEffect(() => {
    if (editSubmittedRef.current && editState.error === null) {
      toast.success('Pattern aggiornato.')
      editSubmittedRef.current = false
      setEditOpen(false)
    }
  }, [editState])

  useEffect(() => {
    if (deleteSubmittedRef.current && deleteState.error === null) {
      toast.success('Pattern eliminato.')
      deleteSubmittedRef.current = false
      setDeleteOpen(false)
    }
  }, [deleteState])

  function handleCategoryChange(value: string) {
    setCategoryId(value)
    setSubCategoryId('')
  }

  return (
    <div className="flex justify-end gap-1">
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Modifica pattern">
            <Pencil className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifica pattern</DialogTitle>
            <DialogDescription>
              Aggiorna la regex e la sottocategoria associata.
            </DialogDescription>
          </DialogHeader>

          <form
            action={(formData) => {
              editSubmittedRef.current = true
              editAction(formData)
            }}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="subCategoryId" value={subCategoryId} />
            <input type="hidden" name="amountSign" value={amountSign} />
            <input type="hidden" name="confidence" value={confidence} />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor={`pattern-regex-${id}`}>
                Pattern regex
              </label>
              <Input id={`pattern-regex-${id}`} name="pattern" defaultValue={pattern} required />
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
                <Select value={subCategoryId} onValueChange={setSubCategoryId} disabled={!selectedCategory}>
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
                <label className="text-sm font-medium" htmlFor={`pattern-confidence-${id}`}>
                  Confidenza
                </label>
                <Input
                  id={`pattern-confidence-${id}`}
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
              <label className="text-sm font-medium" htmlFor={`pattern-description-${id}`}>
                Descrizione
              </label>
              <Input id={`pattern-description-${id}`} name="description" defaultValue={description ?? ''} />
            </div>

            {editState.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{editState.error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Annulla
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isEditPending || !subCategoryId || !confidence}>
                {isEditPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salva modifiche
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Elimina pattern">
            <Trash2 className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Elimina pattern</DialogTitle>
            <DialogDescription>
              Il pattern verrà disattivato e non sarà più usato nelle nuove importazioni.
            </DialogDescription>
          </DialogHeader>
          <form
            action={(formData) => {
              deleteSubmittedRef.current = true
              deleteAction(formData)
            }}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="id" value={id} />
            {deleteState.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{deleteState.error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Annulla
                </Button>
              </DialogClose>
              <Button type="submit" variant="destructive" disabled={isDeletePending}>
                {isDeletePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Elimina
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
