// PROTOTYPE — wipe me.
import { brandingDisplay } from './fonts'
import { PrototypeSwitcher } from './prototype-switcher'
import { VariantA } from './variant-a'
import { VariantB } from './variant-b'
import { VariantC } from './variant-c'

type BrandingProtoPageProps = {
  searchParams: Promise<{ variant?: string }>
}

const SELECTABLE_VARIANTS = ['b', 'c'] as const
type SelectableVariant = (typeof SELECTABLE_VARIANTS)[number]
type Variant = 'a' | SelectableVariant

function resolveVariant(raw: string | undefined): Variant {
  return SELECTABLE_VARIANTS.includes(raw as SelectableVariant) ? (raw as SelectableVariant) : 'a'
}

export default async function BrandingProtoPage({ searchParams }: BrandingProtoPageProps) {
  const { variant: raw } = await searchParams
  const variant = resolveVariant(raw)

  return (
    <div className={`${brandingDisplay.variable} min-h-screen`}>
      {variant === 'a' && <VariantA />}
      {variant === 'b' && <VariantB />}
      {variant === 'c' && <VariantC />}
      <PrototypeSwitcher current={variant} />
    </div>
  )
}
