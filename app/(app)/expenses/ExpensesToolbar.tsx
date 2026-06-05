'use client'

import { DataTableToolbar } from '@/components/data-table/DataTableToolbar'
import { expensesTableConfig } from './expenses.table'

type Props = {
  route: string
  monthsWithData?: string[]
  filterOptions?: Record<string, { value: string; label: string }[]>
}

export function ExpensesToolbar({ route, monthsWithData, filterOptions }: Props) {
  return (
    <DataTableToolbar
      config={expensesTableConfig}
      route={route}
      monthsWithData={monthsWithData}
      filterOptions={filterOptions}
    />
  )
}
