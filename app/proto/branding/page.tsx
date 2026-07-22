// PROTOTYPE — wipe me.
import { brandingDisplay } from './fonts'
import { PrototypeSwitcher } from './prototype-switcher'
import { VariantA } from './variant-a'
import { VariantB } from './variant-b'

type BrandingProtoPageProps = {
  searchParams: Promise<{ variant?: string }>
}

const SELECTABLE_VARIANTS = ['b', 'c'] as const
type SelectableVariant = (typeof SELECTABLE_VARIANTS)[number]
type Variant = 'a' | SelectableVariant

function resolveVariant(raw: string | undefined): Variant {
  return SELECTABLE_VARIANTS.includes(raw as SelectableVariant) ? (raw as SelectableVariant) : 'a'
}

function VariantStub({ axis }: { axis: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="font-mono text-sm text-muted-foreground">PROTOTYPE STUB — {axis}</p>
      <p className="max-w-sm text-sm text-muted-foreground">Questa variante arriva nel prossimo piano di lavoro.</p>
    </div>
  )
}

export default async function BrandingProtoPage({ searchParams }: BrandingProtoPageProps) {
  const { variant: raw } = await searchParams
  const variant = resolveVariant(raw)

  return (
    <div className={`${brandingDisplay.variable} min-h-screen`}>
      {variant === 'a' && <VariantA />}
      {variant === 'b' && <VariantB />}
      {variant === 'c' && <VariantStub axis="Type-led stack" />}
      <PrototypeSwitcher current={variant} />
    </div>
  )
}
