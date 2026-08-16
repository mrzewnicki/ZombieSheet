import SettlementPage from '@/pages/SettlementPage'
import { useHeroOutletContext } from '@/hooks/useHeroOutletContext'

/** Shared settlement sheet embedded as a hero tab. */
export default function SettlementTab() {
  const { gameId } = useHeroOutletContext()
  return <SettlementPage gameId={gameId} embedded />
}
