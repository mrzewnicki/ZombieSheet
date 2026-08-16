import {
  EMPTY_ACTIVATION_BY_RANK,
  MUTATION_CHARACTERS,
  MUTATION_KINDS,
  MUTATION_ORIGINS,
  MUTATION_RANKS,
} from '@/config/mutations'
import type {
  HeroMutation,
  MutationActivationByRank,
  MutationCharacter,
  MutationKind,
  MutationOrigin,
  MutationRank,
  MutationTraitLine,
} from '@/types'

export function normalizeMutation(id: string, raw: Record<string, unknown>): HeroMutation {
  const activationByRank = (raw.activationByRank ?? {}) as Partial<MutationActivationByRank>
  return {
    id,
    name: typeof raw.name === 'string' ? raw.name : '',
    origin: MUTATION_ORIGINS.includes(raw.origin as MutationOrigin)
      ? raw.origin as MutationOrigin
      : 'liveCore',
    kind: MUTATION_KINDS.includes(raw.kind as MutationKind)
      ? raw.kind as MutationKind
      : 'fizyczna',
    character: MUTATION_CHARACTERS.includes(raw.character as MutationCharacter)
      ? raw.character as MutationCharacter
      : 'pasywna',
    rank: MUTATION_RANKS.includes(raw.rank as MutationRank)
      ? raw.rank as MutationRank
      : 1,
    description: typeof raw.description === 'string' ? raw.description : '',
    atuty: Array.isArray(raw.atuty) ? raw.atuty as MutationTraitLine[] : [],
    wady: Array.isArray(raw.wady) ? raw.wady as MutationTraitLine[] : [],
    activationCost: typeof raw.activationCost === 'string' ? raw.activationCost : '',
    activationByRank: {
      1: activationByRank[1] ?? EMPTY_ACTIVATION_BY_RANK[1],
      2: activationByRank[2] ?? EMPTY_ACTIVATION_BY_RANK[2],
      3: activationByRank[3] ?? EMPTY_ACTIVATION_BY_RANK[3],
      4: activationByRank[4] ?? EMPTY_ACTIVATION_BY_RANK[4],
    },
    resonance: typeof raw.resonance === 'string' ? raw.resonance : '',
    hibernating: Boolean(raw.hibernating),
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : undefined,
  }
}

export function mutationRankEffect(
  item: HeroMutation,
  rank: MutationRank,
): string {
  return item.activationByRank[rank]?.trim() ?? ''
}
