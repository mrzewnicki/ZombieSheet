import { FaUser } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'
import type { CampaignNpc, Hero, HeroNpcRelation } from '@/types'
import { heroFullName } from '@/types'
import {
  GRAPH_COLORS,
  HERO_NPC_NODE_ID,
  graphColorForStance,
  layoutHeroNpcGraph,
  npcIdsInRelations,
} from '@/utils/heroNpcRelations'

interface Props {
  hero: Hero
  npcs: CampaignNpc[]
  relations: HeroNpcRelation[]
  selectedNodeId: string | null
  selectedRelationId: string | null
  onSelectNode: (nodeId: string | null) => void
  onSelectRelation: (relationId: string | null) => void
}

const VB = 100

export default function HeroNpcGraph({
  hero,
  npcs,
  relations,
  selectedNodeId,
  selectedRelationId,
  onSelectNode,
  onSelectRelation,
}: Props) {
  const { t } = useTranslation()
  const byId = new Map(npcs.map((n) => [n.id, n]))
  const positions = layoutHeroNpcGraph(relations, VB)
  const npcIds = npcIdsInRelations(relations)
  const heroName = heroFullName(hero, '…')

  return (
    <div className="space-y-2">
      <div
        className="relative w-full aspect-square max-h-[min(60vh,28rem)] rounded-lg border border-border overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, #2a241c 0%, transparent 55%), linear-gradient(165deg, #161410 0%, #0e0c0a 100%)',
        }}
        onClick={() => {
          onSelectNode(null)
          onSelectRelation(null)
        }}
      >
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${VB} ${VB}`} aria-hidden>
          {relations.map((relation) => {
            const from = positions.get(relation.fromId)
            const to = positions.get(relation.toId)
            if (!from || !to) return null
            const mx = (from.x + to.x) / 2
            const my = (from.y + to.y) / 2
            const selected = selectedRelationId === relation.id
            const touchesSelected =
              selectedNodeId != null
              && (relation.fromId === selectedNodeId || relation.toId === selectedNodeId)
            const color = graphColorForStance(relation.stance)
            const label = relation.label.trim()
            return (
              <g
                key={relation.id}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectRelation(selected ? null : relation.id)
                  onSelectNode(null)
                }}
              >
                {/* Wider invisible hit target */}
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="transparent"
                  strokeWidth={4}
                  strokeLinecap="round"
                />
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={color}
                  strokeWidth={selected || touchesSelected ? 1.1 : 0.6}
                  strokeLinecap="round"
                  opacity={selected || touchesSelected ? 1 : 0.7}
                />
                {label && (
                  <g>
                    <rect
                      x={mx - Math.min(18, label.length * 1.1)}
                      y={my - 2.2}
                      width={Math.min(36, label.length * 2.2 + 4)}
                      height={4.4}
                      rx={0.8}
                      fill="#12100e"
                      opacity={0.92}
                    />
                    <text
                      x={mx}
                      y={my + 0.6}
                      textAnchor="middle"
                      fill={selected ? '#e8dcc8' : color}
                      fontSize="2.4"
                      fontFamily="ui-monospace, monospace"
                    >
                      {label.length > 18 ? `${label.slice(0, 16)}…` : label}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>

        <button
          type="button"
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5"
          style={{
            left: `${positions.get(HERO_NPC_NODE_ID)?.x ?? 50}%`,
            top: `${positions.get(HERO_NPC_NODE_ID)?.y ?? 50}%`,
          }}
          onClick={(e) => {
            e.stopPropagation()
            const next = selectedNodeId === HERO_NPC_NODE_ID ? null : HERO_NPC_NODE_ID
            onSelectNode(next)
            onSelectRelation(null)
          }}
          title={heroName}
        >
          <span
            className="w-12 h-12 rounded-full border-2 overflow-hidden bg-void flex items-center justify-center shadow-lg shadow-void/50"
            style={{
              borderColor: GRAPH_COLORS.hero,
              boxShadow:
                selectedNodeId === HERO_NPC_NODE_ID
                  ? `0 0 0 3px ${GRAPH_COLORS.hero}66`
                  : `0 0 0 2px ${GRAPH_COLORS.hero}33`,
            }}
          >
            {hero.imageURL ? (
              <img src={hero.imageURL} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg" style={{ color: GRAPH_COLORS.hero }}>☠</span>
            )}
          </span>
          <span className="text-[9px] leading-tight text-center text-ink px-1 py-0.5 rounded bg-void/85 max-w-[6rem] line-clamp-2">
            {heroName}
          </span>
        </button>

        {npcIds.map((npcId) => {
          const npc = byId.get(npcId)
          const pos = positions.get(npcId)
          if (!npc || !pos) return null
          const selected = selectedNodeId === npcId
          const edge = relations.find(
            (r) => r.fromId === npcId || r.toId === npcId,
          )
          const color = edge ? graphColorForStance(edge.stance) : GRAPH_COLORS.neutral
          return (
            <button
              key={npcId}
              type="button"
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onClick={(e) => {
                e.stopPropagation()
                onSelectNode(selected ? null : npcId)
                onSelectRelation(null)
              }}
              title={[npc.name.trim(), npc.role.trim()].filter(Boolean).join(' · ') || undefined}
            >
              <span
                className="w-10 h-10 rounded-full border-2 overflow-hidden bg-void flex items-center justify-center shadow-md shadow-void/40"
                style={{
                  borderColor: color,
                  boxShadow: selected ? `0 0 0 3px ${color}55` : undefined,
                }}
              >
                {npc.imageURL ? (
                  <img src={npc.imageURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <FaUser className="w-4 h-4" style={{ color }} aria-hidden />
                )}
              </span>
              <span className="text-[9px] leading-tight text-center text-ink px-1 py-0.5 rounded bg-void/85 max-w-[5.5rem] line-clamp-2">
                {npc.name.trim() || '—'}
              </span>
            </button>
          )
        })}
      </div>

      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono uppercase tracking-wider text-ink-faint px-0.5">
        <li className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: GRAPH_COLORS.hero }} />
          {t('hero.npc.legendHero')}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: GRAPH_COLORS.ally }} />
          {t('hero.npc.legendAlly')}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: GRAPH_COLORS.enemy }} />
          {t('hero.npc.legendEnemy')}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: GRAPH_COLORS.neutral }} />
          {t('hero.npc.legendNeutral')}
        </li>
      </ul>
    </div>
  )
}
