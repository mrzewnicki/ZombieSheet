import type { GearTraitDefinition } from '@/types'
import { resolveGearTraits } from '@/utils/gearTraits'
import GearTraitChip from '@/components/hero/GearTraitChip'

interface Props {
  traitIds?: string[]
  catalog: GearTraitDefinition[]
}

export default function GearTraitChips({ traitIds, catalog }: Props) {
  const traits = resolveGearTraits(traitIds, catalog)
  if (traits.length === 0) return null

  return (
    <>
      {traits.map((trait) => (
        <GearTraitChip
          key={trait.id}
          name={trait.name}
          polarity={trait.polarity}
          description={trait.description}
        />
      ))}
    </>
  )
}
