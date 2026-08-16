import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { contaminationIconSrc } from '@/config/contaminationIcons'
import GearStatChip from '@/components/hero/GearStatChip'
import Button from '@/components/ui/Button'
import type { HeroMutation, MutationRank } from '@/types'
import { mutationRankEffect } from '@/utils/mutations'

interface Props {
  items: HeroMutation[]
  canEdit: boolean
  onToggleHibernating: (item: HeroMutation) => void
  busyId?: string | null
}

function RankEffects({ item }: { item: HeroMutation }) {
  const { t } = useTranslation()
  const previousRank = item.rank > 1 ? ((item.rank - 1) as MutationRank) : null
  const previousEffect = previousRank != null ? mutationRankEffect(item, previousRank) : ''
  const currentEffect = mutationRankEffect(item, item.rank)

  return (
    <div className="space-y-1.5">
      {previousEffect && previousRank != null && (
        <p className="text-xs text-ink-muted leading-relaxed whitespace-pre-wrap">
          <span className="text-ink">
            {t('mutations.rankEffect', {
              rank: previousRank,
              rankName: t(`mutations.ranks.${previousRank}`),
            })}
            :{' '}
          </span>
          {previousEffect}
        </p>
      )}
      {currentEffect ? (
        <p className="text-xs text-ink-muted leading-relaxed whitespace-pre-wrap">
          <span className="text-ink">
            {t('mutations.rankEffect', {
              rank: item.rank,
              rankName: t(`mutations.ranks.${item.rank}`),
            })}
            :{' '}
          </span>
          {currentEffect}
        </p>
      ) : (
        <p className="text-xs text-ink-faint italic">{t('combat.mutationNoEffect')}</p>
      )}
    </div>
  )
}

function MutationQuickSlot({
  item,
  canEdit,
  busy,
  onToggleHibernating,
}: {
  item: HeroMutation
  canEdit: boolean
  busy: boolean
  onToggleHibernating: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <div
      className={`
        rounded-lg border overflow-hidden
        ${item.hibernating
          ? 'border-amber-400/30 bg-void/40 opacity-80'
          : 'border-border bg-elevated/40'}
      `}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-3 py-2.5 hover:bg-elevated/60 transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1.5">
            <p className="flex items-center gap-1.5 text-sm text-ink font-medium min-w-0">
              <img
                src={contaminationIconSrc(item.origin)}
                alt={t(`mutations.origins.${item.origin}`)}
                title={t(`mutations.origins.${item.origin}`)}
                className="w-4 h-4 object-contain shrink-0"
              />
              <span className="truncate">{item.name || t('combat.mutationUnnamed')}</span>
            </p>
            <div className="flex flex-wrap gap-1">
              <GearStatChip>
                {t('mutations.rank')} {item.rank}
              </GearStatChip>
              {item.activationCost && (
                <GearStatChip>
                  {t('mutations.activationCost')}: {item.activationCost}
                </GearStatChip>
              )}
              {item.hibernating && (
                <GearStatChip accent>{t('mutations.hibernatingBadge')}</GearStatChip>
              )}
            </div>
          </div>
          <span className="text-ink-faint text-xs shrink-0 mt-0.5">{open ? '▴' : '▾'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-3 py-2.5 space-y-2.5">
          <RankEffects item={item} />
          {item.resonance && (
            <p className="text-xs text-ink-muted leading-relaxed whitespace-pre-wrap">
              <span className="text-ink">{t('mutations.resonance')}: </span>
              {item.resonance}
            </p>
          )}
          {canEdit && (
            <Button
              variant="outline"
              className="text-xs"
              disabled={busy}
              onClick={onToggleHibernating}
            >
              {item.hibernating
                ? t('mutations.clearHibernation')
                : t('mutations.setHibernation')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default function CombatMutationSlots({
  items,
  canEdit,
  onToggleHibernating,
  busyId = null,
}: Props) {
  const { t } = useTranslation()

  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-heading text-sm text-blood-light tracking-widest uppercase">
          {t('combat.mutationsSection')}
        </h3>
        <p className="text-xs text-ink-faint mt-1">{t('combat.mutationsHint')}</p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-ink-faint">{t('combat.mutationsEmpty')}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {items.map((item) => (
            <MutationQuickSlot
              key={item.id}
              item={item}
              canEdit={canEdit}
              busy={busyId === item.id}
              onToggleHibernating={() => onToggleHibernating(item)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
