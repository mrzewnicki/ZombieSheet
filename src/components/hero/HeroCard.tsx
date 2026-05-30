import { Link } from 'react-router-dom'
import type { Hero, GameMember } from '@/types'
import { memberLabel, heroFullName } from '@/types'

interface Props {
  gameId: string
  hero: Hero
  owner?: GameMember
  isGm?: boolean
}

export default function HeroCard({ gameId, hero, owner, isGm }: Props) {
  const displayName = heroFullName(hero)

  return (
    <Link
      to={`/game/${gameId}/hero/${hero.id}/personal`}
      className="block bg-surface border border-border hover:border-blood/50 rounded-lg overflow-hidden transition-colors group"
    >
      {/* Avatar */}
      <div className="h-36 bg-void flex items-center justify-center overflow-hidden relative">
        {hero.imageURL ? (
          <img
            src={hero.imageURL}
            alt={displayName}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
          />
        ) : (
          <span className="text-ink-faint text-5xl select-none">☠</span>
        )}
        {isGm && owner && (
          <span className="absolute top-2 right-2 bg-blood text-ink text-[10px] font-mono px-1.5 py-0.5 rounded">
            MG
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="font-heading text-ink text-base leading-tight truncate">{displayName}</p>
        {owner && (
          <p className="text-xs text-ink-muted mt-0.5 truncate">{memberLabel(owner)}</p>
        )}
      </div>
    </Link>
  )
}
