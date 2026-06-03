// PROTOTYPE — wipe me. Throwaway route to validate the /dashboard/overview redesign.
// Chart variants: ?variant=A|B|C|D|E  — Header variants: ?header=1|2|3|4|5
// Public /proto area (no auth), enabled only in Vercel Preview via PROTOTYPES_ENABLED.
import { AVAILABLE_YEARS } from './mock-data'
import { KpiRow } from './kpi-row'
import { UncategorizedNudge } from './uncategorized-banner'
import { PrototypeSwitcher } from './prototype-switcher'
import { HeaderH1, HeaderH2, HeaderH3, HeaderH4, HeaderH5 } from './header-variants'
import { VariantA } from './variant-a'
import { VariantB } from './variant-b'
import { VariantC } from './variant-c'
import { VariantD } from './variant-d'
import { VariantE } from './variant-e'

type Props = {
  searchParams: Promise<{ variant?: string; year?: string; header?: string }>
}

export default async function OverviewPrototypePage({ searchParams }: Props) {
  const { variant: rawVariant, year: rawYear, header: rawHeader } = await searchParams
  const variant = ['A', 'B', 'C', 'D', 'E'].includes(rawVariant ?? '') ? (rawVariant as string) : 'A'
  const parsedYear = Number(rawYear)
  const year = AVAILABLE_YEARS.includes(parsedYear as (typeof AVAILABLE_YEARS)[number]) ? parsedYear : 2026
  const header = ['1', '2', '3', '4', '5'].includes(rawHeader ?? '') ? (rawHeader as string) : '1'

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {header === '1' && <HeaderH1 year={year} />}
          {header === '2' && <HeaderH2 year={year} />}
          {header === '3' && <HeaderH3 year={year} />}
          {header === '4' && <HeaderH4 year={year} />}
          {header === '5' && <HeaderH5 year={year} />}
        </div>
        <UncategorizedNudge year={year} />
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

      <PrototypeSwitcher current={variant} currentHeader={header} />
    </div>
  )
}
