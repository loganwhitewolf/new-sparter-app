'use client'

import { DataTableToolbar } from '@/components/data-table/DataTableToolbar'
import { transactionsTableConfig } from './transactions.table'

type DependentOptions = Record<string, Record<string, { value: string; label: string }[]>>

type Props = {
  route: string
  monthsWithData?: string[]
  filterOptions?: Record<string, { value: string; label: string }[]>
  dependentOptions?: DependentOptions
}

export function TransactionsToolbar({ route, monthsWithData, filterOptions, dependentOptions }: Props) {
  return (
    <DataTableToolbar
      config={transactionsTableConfig}
      route={route}
      monthsWithData={monthsWithData}
      filterOptions={filterOptions}
      dependentOptions={dependentOptions}
    />
  )
}
