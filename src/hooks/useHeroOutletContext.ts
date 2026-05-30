import { useOutletContext } from 'react-router-dom'
import type { HeroSheetOutletContext } from '@/types'

export function useHeroOutletContext(): HeroSheetOutletContext {
  return useOutletContext<HeroSheetOutletContext>()
}
