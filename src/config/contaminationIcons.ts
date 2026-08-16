import type { ContaminationTrack } from '@/utils/vitals'
import type { MutationOrigin } from '@/types'

/** Shared icons for contamination tracks / mutation origins. */
export const CONTAMINATION_ICONS: Record<ContaminationTrack, string> = {
  deathNet: `${import.meta.env.BASE_URL}icons/contamination/deathNet.png`,
  liveCore: `${import.meta.env.BASE_URL}icons/contamination/liveCore.png`,
  anomalie: `${import.meta.env.BASE_URL}icons/contamination/anomalie.png`,
}

export function contaminationIconSrc(
  track: ContaminationTrack | MutationOrigin,
): string {
  return CONTAMINATION_ICONS[track as ContaminationTrack]
}
