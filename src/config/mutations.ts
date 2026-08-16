import type {
  MutationActivationByRank,
  MutationCharacter,
  MutationKind,
  MutationOrigin,
  MutationRank,
  MutationTraitLine,
} from '@/types'

export const MUTATION_ORIGINS: MutationOrigin[] = ['deathNet', 'liveCore', 'anomalie']
export const MUTATION_KINDS: MutationKind[] = ['fizyczna', 'mentalna', 'psioniczna']
export const MUTATION_CHARACTERS: MutationCharacter[] = ['pasywna', 'aktywna']
export const MUTATION_RANKS: MutationRank[] = [1, 2, 3, 4]

export const EMPTY_ACTIVATION_BY_RANK: MutationActivationByRank = {
  1: '',
  2: '',
  3: '',
  4: '',
}

export function emptyTraitLine(): MutationTraitLine {
  return { name: '', value: 1, description: '' }
}

export function xpCostForRank(rank: MutationRank): number {
  return rank * 4
}
