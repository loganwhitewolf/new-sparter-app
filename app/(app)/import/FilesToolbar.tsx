'use client'

import { DataTableToolbar } from '@/components/data-table/DataTableToolbar'
import { filesTableConfig } from './files.table'

type Props = {
  route: string
  monthsWithData?: string[]
  filterOptions?: Record<string, { value: string; label: string }[]>
}

export function FilesToolbar({ route, monthsWithData, filterOptions }: Props) {
  return (
    <DataTableToolbar
      config={filesTableConfig}
      route={route}
      monthsWithData={monthsWithData}
      filterOptions={filterOptions}
    />
  )
}
