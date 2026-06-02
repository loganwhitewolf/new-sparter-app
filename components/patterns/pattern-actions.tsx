'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, Pencil, Tag, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ClientMountIcon } from '@/components/ui/client-mount-icon'
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
import { SubcategoryPicker } from '@/components/categorization/subcategory-picker'
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

/** Resolve the display name for a subcategory id from the categories tree. */
function getSubCategoryLabel(
  categories: CategoryWithSubCategories[],
  subCategoryId: number,
): string | null {
  for (const cat of categories) {
    const sub = cat.subCategories.find((s) => s.id === subCategoryId)
    if (sub) return sub.name
  }
  return null
}

export function PatternActions({
  id,
  pattern,
  subCategoryId: initialSubCategoryId,
  description,
  categories,
}: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  // subCategoryId state starts from the existing pattern's value
  const [subCategoryId, setSubCategoryId] = useState(String(initialSubCategoryId))
  const [subCategoryLabel, setSubCategoryLabel] = useState<string | null>(
    getSubCategoryLabel(categories, initialSubCategoryId),
  )

  const [editState, editAction, isEditPending] = useActionState(updatePatternAction, { error: null })
  const [deleteState, deleteAction, isDeletePending] = useActionState(deletePatternAction, { error: null })
  const editSubmittedRef = useRef(false)
  const deleteSubmittedRef = useRef(false)

  function resetEditForm() {
    setSubCategoryId(String(initialSubCategoryId))
    setSubCategoryLabel(getSubCategoryLabel(categories, initialSubCategoryId))
  }

  function handleEditOpenChange(open: boolean) {
    if (open) {
      resetEditForm()
    }
    setEditOpen(open)
  }

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

  function handlePickerChange(id: string) {
    setSubCategoryId(id)
    for (const cat of categories) {
      const sub = cat.subCategories.find((s) => String(s.id) === id)
      if (sub) {
        setSubCategoryLabel(sub.name)
        break
      }
    }
  }

  return (
    <div className="flex justify-end gap-1">
      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={handleEditOpenChange}>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Modifica pattern">
            <ClientMountIcon icon={Pencil} ariaHidden className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifica pattern</DialogTitle>
            <DialogDescription>
              Aggiorna la regex e la sottocategoria associata. Sono accettati sia
              <span className="font-mono"> netflix</span> sia <span className="font-mono">/netflix/i</span>;
              il pattern resta salvato in forma canonica.
            </DialogDescription>
          </DialogHeader>

          <form
            action={(formData) => {
              editSubmittedRef.current = true
              editAction(formData)
            }}
            className="flex flex-col gap-4"
          >
            {/* Hidden inputs */}
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="subCategoryId" value={subCategoryId} />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor={`pattern-regex-${id}`}>
                Pattern regex
              </label>
              <Input
                id={`pattern-regex-${id}`}
                name="pattern"
                defaultValue={pattern}
                placeholder="es. netflix oppure /netflix/i"
                required
              />
              <p className="text-xs text-muted-foreground">
                La forma <span className="font-mono">/pattern/i</span> viene normalizzata alla sola sorgente e
                usata con match case-insensitive.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Sottocategoria</label>
              <Button
                type="button"
                variant="outline"
                className="justify-start font-normal"
                onClick={() => setPickerOpen(true)}
              >
                <ClientMountIcon icon={Tag} ariaHidden className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                {subCategoryLabel ?? 'Categorizza…'}
              </Button>
            </div>

            <SubcategoryPicker
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              categories={categories}
              mostUsed={[]}
              allowedCategoryTypes={['in', 'out', 'transfer', 'system']}
              defaultType={null}
              onChange={handlePickerChange}
            />

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
              <Button type="submit" disabled={isEditPending || !subCategoryId}>
                {isEditPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salva modifiche
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete dialog — unchanged */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Elimina pattern">
            <ClientMountIcon icon={Trash2} ariaHidden className="h-4 w-4" />
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
