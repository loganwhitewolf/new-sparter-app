'use client'

import { DataTableToolbar } from '@/components/data-table/DataTableToolbar'
import { transactionsTableConfig } from './transactions.table'

type Props = {
  route: string
  monthsWithData?: string[]
  filterOptions?: Record<string, { value: string; label: string }[]>
}

export function TransactionsToolbar({ route, monthsWithData, filterOptions }: Props) {
  return (
    <DataTableToolbar
      config={transactionsTableConfig}
      route={route}
      monthsWithData={monthsWithData}
      filterOptions={filterOptions}
    />
  )
}
