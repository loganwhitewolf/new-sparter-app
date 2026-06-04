// PROTOTYPE — wipe me. Toolbar Filtri/Ordinamento — 3 variants via ?variant=
import { PrototypeSwitcher } from './prototype-switcher'
import { VariantA } from './variant-a'
import { VariantB } from './variant-b'
import { VariantC } from './variant-c'

export default async function TableToolbarProtoPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>
}) {
  const { variant = 'A' } = await searchParams

  return (
    <>
      {variant === 'B' ? <VariantB /> : variant === 'C' ? <VariantC /> : <VariantA />}
      <PrototypeSwitcher current={variant} />
    </>
  )
}
