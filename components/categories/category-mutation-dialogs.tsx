'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
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
  deleteCategoryAction,
  deleteSubcategoryAction,
  renameCategoryAction,
  renameSubcategoryAction,
} from '@/lib/actions/categories'
import type { CategoryWithSubCategories } from '@/lib/dal/categories'
import type { ActionState } from '@/lib/validations/category'

type CategoryType = 'in' | 'out'

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

export function CreateCategoryDialog() {
  const [type, setType] = useState<CategoryType>('out')
  const { open, setOpen, state, submit, isPending } = useDialogAction(
    createCategoryAction,
    'Categoria creata.',
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
            Crea una categoria personale per organizzare entrate o uscite. Le categorie di sistema restano condivise.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="type" value={type} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="category-name-new">Nome categoria</label>
            <Input id="category-name-new" name="name" required placeholder="es. Casa vacanze" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Tipo</label>
            <Select value={type} onValueChange={(value) => setType(value as CategoryType)}>
              <SelectTrigger className="w-full" aria-label="Tipo categoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="out">Uscite</SelectItem>
                <SelectItem value="in">Entrate</SelectItem>
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
  const { open, setOpen, state, submit, isPending } = useDialogAction(
    createSubcategoryAction,
    'Sottocategoria creata.',
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
            Aggiungi una sottocategoria personale sotto “{category.name}”.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <input type="hidden" name="categoryId" value={category.id} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor={`subcategory-name-new-${category.id}`}>Nome sottocategoria</label>
            <Input id={`subcategory-name-new-${category.id}`} name="name" required placeholder="es. Supermercato" />
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
              : `Crea un nome visibile solo per te. Il nome originale resta “${subCategory.originalName}”.`}
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
            La categoria verrà disattivata. Se contiene sottocategorie collegate a spese, l’operazione verrà bloccata.
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
            Le sottocategorie collegate a spese non possono essere eliminate: il blocco evita categorie mancanti nello storico.
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
