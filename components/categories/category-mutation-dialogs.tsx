'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { AlertCircle, Ban, Loader2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createCategoryAction,
  createSubcategoryAction,
  deactivateCategoryAction,
  deactivateSubcategoryAction,
  deleteCategoryAction,
  deleteSubcategoryAction,
  reactivateCategoryAction,
  reactivateSubcategoryAction,
  renameCategoryAction,
  renameSubcategoryAction,
} from '@/lib/actions/categories'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import {
  DEFAULT_NATURE_BY_DIRECTION,
  DIRECTION_LABELS,
  DIRECTION_ORDER,
  NATURE_LABELS,
  NATURES_BY_DIRECTION,
  isDirectionCode,
  type DirectionCode,
  type FlowNature,
} from '@/lib/utils/nature-labels'
import type { ActionState } from '@/lib/validations/category'

function useDialogAction(
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>,
  successMessage: string,
  onSuccess?: () => void,
) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(action, { error: null })
  const submittedRef = useRef(false)

  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      toast.success(successMessage)
      submittedRef.current = false
      setOpen(false)
      onSuccess?.()
    }
  }, [onSuccess, state, successMessage])

  function submit(formData: FormData) {
    submittedRef.current = true
    formAction(formData)
  }

  return { open, setOpen, state, submit, isPending }
}

function SubmitButton({ children, isPending, variant = 'default' }: {
  children: string
  isPending: boolean
  variant?: 'default' | 'destructive'
}) {
  return (
    <Button type="submit" variant={variant} disabled={isPending}>
      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  )
}

function ActionError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )
}

function naturesForCategoryDirection(type: CategoryWithSubCategories['type']): FlowNature[] {
  if (isDirectionCode(type)) {
    return [...NATURES_BY_DIRECTION[type]]
  }
  return Object.values(NATURES_BY_DIRECTION).flat()
}

function defaultNatureForCategory(type: CategoryWithSubCategories['type']): FlowNature {
  if (isDirectionCode(type)) return DEFAULT_NATURE_BY_DIRECTION[type]
  return 'discretionary'
}

export function CreateCategoryDialog() {
  const [direction, setDirection] = useState<DirectionCode>('out')
  const { open, setOpen, state, submit, isPending } = useDialogAction(
    createCategoryAction,
    'Categoria creata.',
    () => setDirection('out'),
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" aria-label="Crea categoria personale">
          <ClientMountIcon icon={Plus} ariaHidden className="mr-2 h-4 w-4" />
          Nuova categoria
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuova categoria personale</DialogTitle>
          <DialogDescription>
            Scegli la direzione (Entrate, Uscite, Accantonamenti o Trasferimenti). Le sottocategorie
            e la loro natura le aggiungi dopo.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="direction" value={direction} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="category-name-new">Nome categoria</label>
            <Input id="category-name-new" name="name" required placeholder="es. Casa vacanze" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="category-direction-new">Direzione</label>
            <Select value={direction} onValueChange={(v) => setDirection(v as DirectionCode)}>
              <SelectTrigger id="category-direction-new" className="w-full" aria-label="Direzione categoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIRECTION_ORDER.map((key) => (
                  <SelectItem key={key} value={key}>
                    {DIRECTION_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ActionError error={state.error} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Annulla</Button></DialogClose>
            <SubmitButton isPending={isPending}>Crea categoria</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CreateSubcategoryDialog({ category }: { category: CategoryWithSubCategories }) {
  const natureOptions = naturesForCategoryDirection(category.type)
  const [nature, setNature] = useState<string>(() => defaultNatureForCategory(category.type))
  const { open, setOpen, state, submit, isPending } = useDialogAction(
    createSubcategoryAction,
    'Sottocategoria creata.',
    () => setNature(defaultNatureForCategory(category.type)),
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="xs" aria-label={`Crea sottocategoria in ${category.name}`}>
          <ClientMountIcon icon={Plus} ariaHidden className="mr-1 h-3 w-3" />
          Sottocategoria
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuova sottocategoria</DialogTitle>
          <DialogDescription>
            Aggiungi una sottocategoria personale sotto "{category.name}". Qui scegli la natura
            (es. Essenziale, Entrate ricorrenti).
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="categoryId" value={category.id} />
          <input type="hidden" name="nature" value={nature} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor={`subcategory-name-new-${category.id}`}>Nome sottocategoria</label>
            <Input id={`subcategory-name-new-${category.id}`} name="name" required placeholder="es. Supermercato" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor={`subcategory-nature-new-${category.id}`}>Natura</label>
            <Select value={nature} onValueChange={setNature}>
              <SelectTrigger id={`subcategory-nature-new-${category.id}`} className="w-full" aria-label="Natura sottocategoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {natureOptions.map((key) => (
                  <SelectItem key={key} value={key}>
                    {NATURE_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ActionError error={state.error} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Annulla</Button></DialogClose>
            <SubmitButton isPending={isPending}>Crea sottocategoria</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function RenameCategoryDialog({ category }: { category: CategoryWithSubCategories }) {
  const { open, setOpen, state, submit, isPending } = useDialogAction(
    renameCategoryAction,
    'Categoria aggiornata.',
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Rinomina categoria ${category.name}`}>
          <ClientMountIcon icon={Pencil} ariaHidden className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rinomina categoria personale</DialogTitle>
          <DialogDescription>Puoi rinominare solo le categorie personali.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={category.id} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor={`category-name-${category.id}`}>Nome categoria</label>
            <Input id={`category-name-${category.id}`} name="name" defaultValue={category.name} required />
          </div>
          <ActionError error={state.error} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Annulla</Button></DialogClose>
            <SubmitButton isPending={isPending}>Salva modifiche</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type Subcategory = CategoryWithSubCategories['subCategories'][number]

export function RenameSubcategoryDialog({ subCategory }: { subCategory: Subcategory }) {
  const { open, setOpen, state, submit, isPending } = useDialogAction(
    renameSubcategoryAction,
    subCategory.isOwned ? 'Sottocategoria aggiornata.' : 'Nome personale salvato.',
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={subCategory.isOwned ? `Rinomina sottocategoria ${subCategory.name}` : `Personalizza nome sottocategoria ${subCategory.originalName}`}
        >
          <ClientMountIcon icon={Pencil} ariaHidden className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{subCategory.isOwned ? 'Rinomina sottocategoria personale' : 'Nome personale per sottocategoria di sistema'}</DialogTitle>
          <DialogDescription>
            {subCategory.isOwned
              ? 'Aggiorna il nome della tua sottocategoria personale.'
              : `Crea un nome visibile solo per te. Il nome originale resta "${subCategory.originalName}".`}
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={subCategory.id} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor={`subcategory-name-${subCategory.id}`}>Nome sottocategoria</label>
            <Input id={`subcategory-name-${subCategory.id}`} name="name" defaultValue={subCategory.name} required />
          </div>
          <ActionError error={state.error} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Annulla</Button></DialogClose>
            <SubmitButton isPending={isPending}>Salva modifiche</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeactivateCategoryDialog({ category }: { category: CategoryWithSubCategories }) {
  const { open, setOpen, state, submit, isPending } = useDialogAction(
    deactivateCategoryAction,
    'Categoria disattivata.',
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Disattiva categoria ${category.name}`}>
          <ClientMountIcon icon={Ban} ariaHidden className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Disattiva categoria personale</DialogTitle>
          <DialogDescription>
            Resta in elenco come Disabilitata (opaca) e sparisce dai selettori. Lo storico
            delle spese resta intatto. Consentita anche con spese collegate.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={category.id} />
          <ActionError error={state.error} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Annulla</Button></DialogClose>
            <SubmitButton isPending={isPending} variant="destructive">Disattiva</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ReactivateCategoryDialog({ category }: { category: CategoryWithSubCategories }) {
  const { open, setOpen, state, submit, isPending } = useDialogAction(
    reactivateCategoryAction,
    'Categoria riattivata.',
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Riattiva categoria ${category.name}`}>
          <ClientMountIcon icon={RotateCcw} ariaHidden className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Riattiva categoria personale</DialogTitle>
          <DialogDescription>
            Torna disponibile nei selettori. Le sottocategorie disabilitate restano disabilitate:
            riattivale una per una se serve.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={category.id} />
          <ActionError error={state.error} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Annulla</Button></DialogClose>
            <SubmitButton isPending={isPending}>Riattiva</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteCategoryDialog({ category }: { category: CategoryWithSubCategories }) {
  const { open, setOpen, state, submit, isPending } = useDialogAction(
    deleteCategoryAction,
    'Categoria eliminata.',
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Elimina categoria ${category.name}`}>
          <ClientMountIcon icon={Trash2} ariaHidden className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Elimina categoria personale</DialogTitle>
          <DialogDescription>
            Rimozione definitiva dal database. Bloccata se ci sono spese collegate: in quel caso
            usa Disattiva. Dopo l'eliminazione puoi ricreare una categoria con lo stesso nome.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={category.id} />
          <ActionError error={state.error} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Annulla</Button></DialogClose>
            <SubmitButton isPending={isPending} variant="destructive">Elimina</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeactivateSubcategoryDialog({ subCategory }: { subCategory: Subcategory }) {
  const { open, setOpen, state, submit, isPending } = useDialogAction(
    deactivateSubcategoryAction,
    'Sottocategoria disattivata.',
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Disattiva sottocategoria ${subCategory.name}`}>
          <ClientMountIcon icon={Ban} ariaHidden className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Disattiva sottocategoria personale</DialogTitle>
          <DialogDescription>
            Resta in elenco come Disabilitata (opaca) e sparisce dai selettori. Resta collegata alle
            spese già categorizzate. Consentita anche con spese collegate.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={subCategory.id} />
          <ActionError error={state.error} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Annulla</Button></DialogClose>
            <SubmitButton isPending={isPending} variant="destructive">Disattiva</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ReactivateSubcategoryDialog({ subCategory }: { subCategory: Subcategory }) {
  const { open, setOpen, state, submit, isPending } = useDialogAction(
    reactivateSubcategoryAction,
    'Sottocategoria riattivata.',
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Riattiva sottocategoria ${subCategory.name}`}>
          <ClientMountIcon icon={RotateCcw} ariaHidden className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Riattiva sottocategoria personale</DialogTitle>
          <DialogDescription>
            Torna disponibile nei selettori. Se la categoria padre è disabilitata, riattivala prima.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={subCategory.id} />
          <ActionError error={state.error} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Annulla</Button></DialogClose>
            <SubmitButton isPending={isPending}>Riattiva</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteSubcategoryDialog({ subCategory }: { subCategory: Subcategory }) {
  const { open, setOpen, state, submit, isPending } = useDialogAction(
    deleteSubcategoryAction,
    'Sottocategoria eliminata.',
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Elimina sottocategoria ${subCategory.name}`}>
          <ClientMountIcon icon={Trash2} ariaHidden className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Elimina sottocategoria personale</DialogTitle>
          <DialogDescription>
            Rimozione definitiva. Bloccata se collegata a spese: in quel caso usa Disattiva.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={subCategory.id} />
          <ActionError error={state.error} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Annulla</Button></DialogClose>
            <SubmitButton isPending={isPending} variant="destructive">Elimina</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
