import { z } from 'zod'

export type ActionState = { error: string | null }

const MAX_NAME_LENGTH = 100
const NAME_REQUIRED_MESSAGE = 'Inserisci un nome.'
const NAME_TOO_LONG_MESSAGE = 'Il nome deve contenere al massimo 100 caratteri.'
const ID_REQUIRED_MESSAGE = 'ID mancante.'

export function normalizeCategoryName(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

export function deriveCategorySlug(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_NAME_LENGTH)
    .replace(/-+$/g, '')

  return slug || 'categoria'
}

const NameSchema = z.preprocess(
  normalizeCategoryName,
  z.string().min(1, NAME_REQUIRED_MESSAGE).max(MAX_NAME_LENGTH, NAME_TOO_LONG_MESSAGE),
)

const IdSchema = z.preprocess(
  (value) => (value === null || value === undefined || value === '' ? undefined : Number(value)),
  z.number({ message: ID_REQUIRED_MESSAGE }).int('ID non valido.').positive('ID non valido.'),
)

export const CreateCategorySchema = z.object({
  name: NameSchema,
  type: z.enum(['in', 'out'], { message: 'Tipo categoria non valido.' }),
}).transform((input) => ({
  ...input,
  slug: deriveCategorySlug(input.name),
}))

export const RenameCategorySchema = z.object({
  id: IdSchema,
  name: NameSchema,
}).transform((input) => ({
  ...input,
  slug: deriveCategorySlug(input.name),
}))

export const DeleteCategorySchema = z.object({
  id: IdSchema,
})

export const NatureSchema = z.enum([
  'essential',
  'discretionary',
  'operational',
  'financial',
  'debt',
  'extraordinary',
])

export const SetSubcategoryNatureSchema = z.object({
  subCategoryId: z.coerce.number().int().positive(),
  nature: NatureSchema.nullable(),
})

export const CreateSubcategorySchema = z.object({
  categoryId: IdSchema,
  name: NameSchema,
  nature: NatureSchema,
}).transform((input) => ({
  ...input,
  slug: deriveCategorySlug(input.name),
}))

export const RenameSubcategorySchema = z.object({
  id: IdSchema,
  name: NameSchema,
}).transform((input) => ({
  ...input,
  slug: deriveCategorySlug(input.name),
}))

export const DeleteSubcategorySchema = z.object({
  id: IdSchema,
})

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>
export type RenameCategoryInput = z.infer<typeof RenameCategorySchema>
export type DeleteCategoryInput = z.infer<typeof DeleteCategorySchema>
export type CreateSubcategoryInput = z.infer<typeof CreateSubcategorySchema>
export type RenameSubcategoryInput = z.infer<typeof RenameSubcategorySchema>
export type DeleteSubcategoryInput = z.infer<typeof DeleteSubcategorySchema>
export type SetSubcategoryNatureInput = z.infer<typeof SetSubcategoryNatureSchema>
