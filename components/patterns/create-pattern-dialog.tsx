'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, Plus, Tag } from 'lucide-react'
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
import { createPatternAction } from '@/lib/actions/patterns'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'

type Props = {
  categories: CategoryWithSubCategories[]
}

export function CreatePatternDialog({ categories }: Props) {
  const [open, setOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [subCategoryId, setSubCategoryId] = useState('')
  const [subCategoryLabel, setSubCategoryLabel] = useState<string | null>(null)
  const [state, formAction, isPending] = useActionState(createPatternAction, { error: null })
  const submittedRef = useRef(false)

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      toast.success('Pattern creato con successo.')
      submittedRef.current = false
      setOpen(false)
      setSubCategoryId('')
      setSubCategoryLabel(null)
    }
  }, [state])

  function handlePickerChange(id: string) {
    setSubCategoryId(id)
    // Resolve display label from the categories tree
    for (const cat of categories) {
      const sub = cat.subCategories.find((s) => String(s.id) === id)
      if (sub) {
        setSubCategoryLabel(sub.name)
        break
      }
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setSubCategoryId('')
      setSubCategoryLabel(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <ClientMountIcon icon={Plus} ariaHidden className="mr-2 h-4 w-4" />
          Nuovo pattern
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuovo pattern personalizzato</DialogTitle>
          <DialogDescription>
            Crea una regola regex da applicare prima dei pattern di sistema. Puoi inserire
            <span className="font-mono"> netflix</span> oppure <span className="font-mono">/netflix/i</span>:
            verrà salvata la sorgente canonica.
          </DialogDescription>
        </DialogHeader>

        <form
          action={(formData) => {
            submittedRef.current = true
            formAction(formData)
          }}
          className="flex flex-col gap-4"
        >
          {/* Hidden input carrying the chosen subcategory id */}
          <input type="hidden" name="subCategoryId" value={subCategoryId} />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="pattern-regex">
              Pattern regex <span className="text-destructive">*</span>
            </label>
            <Input
              id="pattern-regex"
              name="pattern"
              placeholder="es. netflix oppure /netflix/i"
              required
            />
            <p className="text-xs text-muted-foreground">
              Scrivi una sorgente regex come <span className="font-mono">netflix</span> oppure la forma
              <span className="font-mono"> /netflix/i</span>; viene salvata senza delimitatori e valutata
              senza distinzione tra maiuscole e minuscole.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Sottocategoria <span className="text-destructive">*</span></label>
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
            allowedCategoryTypes={['in', 'out', 'transfer', 'allocation']}
            defaultType={null}
            onChange={handlePickerChange}
          />

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
            <Button type="submit" disabled={isPending || !subCategoryId}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crea pattern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
