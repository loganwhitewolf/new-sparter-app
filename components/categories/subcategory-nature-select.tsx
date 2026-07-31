'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  NATURE_LABELS,
  NATURE_ORDER,
  NATURES_BY_DIRECTION,
  isDirectionCode,
  type DirectionCode,
  type FlowNature,
} from '@/lib/utils/nature-labels'
import { setSubcategoryNatureAction } from '@/lib/actions/categories'

function natureOptionsForDirection(direction: DirectionCode | null | undefined): Array<FlowNature | null> {
  if (isDirectionCode(direction)) {
    return [...NATURES_BY_DIRECTION[direction], null]
  }
  return [...NATURE_ORDER]
}

export function SubcategoryNatureSelect({
  subCategoryId,
  effectiveNature,
  direction,
}: {
  subCategoryId: number
  effectiveNature: FlowNature | null
  /** When set, only natures for this category direction are offered (+ Non classificato). */
  direction?: DirectionCode | null
}) {
  const [isPending, startTransition] = useTransition()
  const options = natureOptionsForDirection(direction)

  function handleChange(value: string) {
    const nature: FlowNature | null = value === 'unclassified' ? null : (value as FlowNature)
    startTransition(async () => {
      const result = await setSubcategoryNatureAction({ subCategoryId, nature })
      if (!result.ok) {
        toast.error(result.error)
      }
    })
  }

  return (
    <Select
      value={effectiveNature ?? 'unclassified'}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger className="w-[160px] h-8 text-xs" aria-label="Natura sottocategoria">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((key) => {
          const value = key ?? 'unclassified'
          return (
            <SelectItem key={value} value={value} className="text-xs">
              {NATURE_LABELS[value]}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
