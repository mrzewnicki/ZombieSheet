import { useTranslation } from 'react-i18next'
import { FaBed, FaBiohazard, FaBrain, FaDna, FaHeart } from 'react-icons/fa'
import type { IconType } from 'react-icons'
import { MUTATIONS_DOC_URL, VITALS_DOC_URL } from '@/config/rpg-system'
import type { HeroVitals } from '@/types'
import {
  contaminationTotal,
  type VitalMaxes,
} from '@/utils/vitals'

interface Props {
  vitals: HeroVitals
  max: VitalMaxes
  canEdit: boolean
  onPoolChange?: (key: PoolKey, value: number) => void
  onContaminationTotalChange?: (total: number) => void
}

export type PoolKey = 'hp' | 'fatigue' | 'stress' | 'mutationPoints'

type HeaderVitalId = PoolKey | 'contamination'

const VITAL_ICONS: Record<HeaderVitalId, IconType> = {
  hp: FaHeart,
  fatigue: FaBed,
  stress: FaBrain,
  mutationPoints: FaDna,
  contamination: FaBiohazard,
}

const POOL_KEYS: PoolKey[] = ['hp', 'fatigue', 'stress', 'mutationPoints']

/** Green at full, yellow around half, red near empty (spendable pools). */
function poolIconClass(current: number, max: number): string {
  if (max <= 0) return current <= 0 ? 'text-blood' : 'text-emerald-400'
  const ratio = current / max
  if (ratio >= 0.75) return 'text-emerald-400'
  if (ratio >= 0.35) return 'text-amber-400'
  return 'text-blood'
}

/** Green near empty, yellow around half, red near/over max (fill tracks). */
function fillIconClass(current: number, max: number): string {
  if (max <= 0) return current <= 0 ? 'text-emerald-400' : 'text-blood'
  const ratio = current / max
  if (ratio <= 0.25) return 'text-emerald-400'
  if (ratio <= 0.65) return 'text-amber-400'
  return 'text-blood'
}

function HeaderVital({
  vitalId,
  label,
  tooltip,
  current,
  max,
  canEdit,
  allowOverMax,
  colorMode,
  docUrl,
  decreaseLabel,
  increaseLabel,
  readMoreLabel,
  onChange,
}: {
  vitalId: HeaderVitalId
  label: string
  tooltip: string
  current: number
  max: number
  canEdit: boolean
  allowOverMax?: boolean
  colorMode: 'pool' | 'fill'
  docUrl: string
  decreaseLabel: string
  increaseLabel: string
  readMoreLabel: string
  onChange?: (value: number) => void
}) {
  const Icon = VITAL_ICONS[vitalId]
  const iconClass = colorMode === 'pool'
    ? poolIconClass(current, max)
    : fillIconClass(current, max)
  const atMax = !allowOverMax && current >= max

  return (
    <div className="relative z-0 hover:z-50 flex flex-col items-center gap-0">
      <div className="relative group/vital">
        <span
          className={`inline-flex items-center justify-center cursor-default ${iconClass}`}
          title={label}
          aria-label={label}
        >
          <Icon className="w-7 h-7" aria-hidden />
        </span>
        <div className="
          absolute right-full top-1/2 -translate-y-1/2 z-50 pr-2
          pointer-events-none group-hover/vital:pointer-events-auto
          opacity-0 group-hover/vital:opacity-100
          translate-x-1 group-hover/vital:translate-x-0
          transition-all duration-150
        ">
          <div className="w-56 px-3 py-2 rounded border border-border bg-void text-xs text-ink-muted leading-snug shadow-lg">
            <p className="text-ink mb-1 flex items-center gap-1.5">
              <Icon className={`w-3.5 h-3.5 ${iconClass}`} aria-hidden />
              {label}
            </p>
            {tooltip}
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2 text-blood-light hover:text-blood transition-colors"
            >
              {readMoreLabel}
            </a>
            <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-border" />
          </div>
        </div>
      </div>

      {canEdit ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange?.(Math.max(0, current - 1))}
            className="w-5 h-5 rounded bg-elevated hover:bg-blood/20 text-ink-muted hover:text-ink transition-colors font-mono text-xs leading-none"
            aria-label={`${decreaseLabel} ${label}`}
          >
            −
          </button>
          <span className="font-mono text-lg text-ink tabular-nums min-w-[3.25rem] text-center">
            {current}
            <span className="text-ink-faint text-base">/{max}</span>
          </span>
          <button
            type="button"
            onClick={() => onChange?.(current + 1)}
            disabled={atMax}
            className="w-5 h-5 rounded bg-elevated hover:bg-blood/20 text-ink-muted hover:text-ink transition-colors font-mono text-xs leading-none disabled:opacity-30 disabled:hover:bg-elevated disabled:hover:text-ink-muted"
            aria-label={`${increaseLabel} ${label}`}
          >
            +
          </button>
        </div>
      ) : (
        <span className="font-mono text-lg text-ink tabular-nums">
          {current}
          <span className="text-ink-faint text-base">/{max}</span>
        </span>
      )}
    </div>
  )
}

export default function HeroHeaderVitals({
  vitals,
  max,
  canEdit,
  onPoolChange,
  onContaminationTotalChange,
}: Props) {
  const { t } = useTranslation()
  const readMore = t('vitals.readMore')
  const contamination = contaminationTotal(vitals.contamination)

  return (
    <div className="ml-auto relative z-30 flex flex-wrap items-end justify-end gap-x-5 gap-y-2">
      {POOL_KEYS.map((key) => (
        <HeaderVital
          key={key}
          vitalId={key}
          label={t(`vitals.${key}`)}
          tooltip={t(`vitals.formulas.${key}`)}
          current={vitals[key]}
          max={max[key]}
          canEdit={canEdit}
          colorMode="pool"
          docUrl={key === 'mutationPoints' ? MUTATIONS_DOC_URL : VITALS_DOC_URL}
          decreaseLabel={t('mechanics.decrease')}
          increaseLabel={t('mechanics.increase')}
          readMoreLabel={readMore}
          onChange={(value) => onPoolChange?.(key, value)}
        />
      ))}
      <HeaderVital
        vitalId="contamination"
        label={t('vitals.contamination')}
        tooltip={t('vitals.formulas.contamination', {
          deathNet: vitals.contamination.deathNet,
          liveCore: vitals.contamination.liveCore,
          anomalie: vitals.contamination.anomalie,
        })}
        current={contamination}
        max={max.contamination}
        canEdit={canEdit}
        allowOverMax
        colorMode="fill"
        docUrl={MUTATIONS_DOC_URL}
        decreaseLabel={t('mechanics.decrease')}
        increaseLabel={t('mechanics.increase')}
        readMoreLabel={readMore}
        onChange={(value) => onContaminationTotalChange?.(value)}
      />
    </div>
  )
}
