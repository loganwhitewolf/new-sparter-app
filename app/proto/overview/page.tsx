// PROTOTYPE — wipe me. Throwaway route to validate the /dashboard/overview redesign.
// Five variants of the hero chart, switchable via ?variant=A|B|C|D|E.
// Public /proto area (no auth), enabled only in Vercel Preview via PROTOTYPES_ENABLED.
import { AVAILABLE_YEARS } from './mock-data'
import { KpiRow } from './kpi-row'
import { YearSelect } from './year-select'
import { PrototypeSwitcher } from './prototype-switcher'
import { VariantA } from './variant-a'
import { VariantB } from './variant-b'
import { VariantC } from './variant-c'
import { VariantD } from './variant-d'
import { VariantE } from './variant-e'

type Props = {
  searchParams: Promise<{ variant?: string; year?: string }>
}

export default async function OverviewPrototypePage({ searchParams }: Props) {
  const { variant: rawVariant, year: rawYear } = await searchParams
  const variant = ['A', 'B', 'C', 'D', 'E'].includes(rawVariant ?? '') ? (rawVariant as string) : 'A'
  const parsedYear = Number(rawYear)
  const year = AVAILABLE_YEARS.includes(parsedYear as (typeof AVAILABLE_YEARS)[number]) ? parsedYear : 2026

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Dashboard — prototipo</h1>
          <p className="text-sm text-muted-foreground">Panoramica delle tue finanze · anno {year}</p>
        </div>
        <YearSelect year={year} />
      </div>

      <div className="shrink-0">
        <KpiRow year={year} />
      </div>

      <div className="min-h-0 flex-1">
        {variant === 'A' && <VariantA year={year} />}
        {variant === 'B' && <VariantB year={year} />}
        {variant === 'C' && <VariantC year={year} />}
        {variant === 'D' && <VariantD year={year} />}
        {variant === 'E' && <VariantE year={year} />}
      </div>

      <PrototypeSwitcher current={variant} />
    </div>
  )
}
