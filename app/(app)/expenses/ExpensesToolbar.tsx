'use client'

import { DataTableToolbar } from '@/components/data-table/DataTableToolbar'
import { expensesTableConfig } from './expenses.table'

type DependentOptions = Record<string, Record<string, { value: string; label: string }[]>>

type Props = {
  route: string
  monthsWithData?: string[]
  filterOptions?: Record<string, { value: string; label: string }[]>
  dependentOptions?: DependentOptions
}

export function ExpensesToolbar({ route, monthsWithData, filterOptions, dependentOptions }: Props) {
  return (
    <DataTableToolbar
      config={expensesTableConfig}
      route={route}
      monthsWithData={monthsWithData}
      filterOptions={filterOptions}
      dependentOptions={dependentOptions}
    />
  )
}
