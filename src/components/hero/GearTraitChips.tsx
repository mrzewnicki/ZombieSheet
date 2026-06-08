import type { GearTraitDefinition, GearTraitValues } from '@/types'
import { resolveGearTraits, resolveGearTraitValue } from '@/utils/gearTraits'
import GearTraitChip from '@/components/hero/GearTraitChip'

interface Props {
  traitIds?: string[]
  traitValues?: GearTraitValues
  catalog: GearTraitDefinition[]
}

export default function GearTraitChips({ traitIds, traitValues, catalog }: Props) {
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
          value={resolveGearTraitValue(trait.id, traitValues)}
        />
      ))}
    </>
  )
}
