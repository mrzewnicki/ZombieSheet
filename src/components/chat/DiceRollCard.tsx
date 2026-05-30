import { useTranslation } from 'react-i18next'
import {
  getDiceOutcomeClass,
  diceOutcomeI18nKey,
  groupRollsByOutcome,
  DICE_OUTCOME_DISPLAY_ORDER,
  type DiceOutcomeKind,
} from '@/utils/diceRoll'

const OUTCOME_CLASS: Record<DiceOutcomeKind, string> = {
  problem: 'text-red-400',
  failure: 'text-orange-400',
  success: 'text-green-400',
  critical: 'text-yellow-300',
}

function DiceChip({ value }: { value: number }) {
  return (
    <span
      className={`inline-flex min-w-[1.75rem] items-center justify-center rounded border border-border/70 bg-void/90 px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums ${getDiceOutcomeClass(value)}`}
    >
      {value}
    </span>
  )
}

function GroupedRollList({ rolls }: { rolls: number[] }) {
  const { t } = useTranslation()
  const groups = groupRollsByOutcome(rolls)
  const rows = DICE_OUTCOME_DISPLAY_ORDER
    .filter((kind) => groups[kind].length > 0)
    .map((kind) => ({ kind, dice: groups[kind] }))

  if (rows.length === 0) return null

  return (
    <ul className="mt-2 space-y-1.5">
      {rows.map(({ kind, dice }) => (
        <li key={kind} className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`shrink-0 text-xs font-mono font-semibold ${OUTCOME_CLASS[kind]}`}>
            {t(diceOutcomeI18nKey(kind))} {dice.length}
          </span>
          <span className="flex flex-wrap gap-1">
            {dice.map((value, i) => (
              <DiceChip key={i} value={value} />
            ))}
          </span>
        </li>
      ))}
    </ul>
  )
}

function RollPoolLine({
  attributeKey,
  attributeLabel,
  attributeValue,
  skillKey,
  skillLabel,
  skillValue,
  modifier,
  poolTotal,
}: {
  attributeKey?: string
  attributeLabel?: string
  attributeValue?: number
  skillKey?: string
  skillLabel?: string
  skillValue?: number
  modifier?: number
  poolTotal?: number
}) {
  const { t } = useTranslation()
  const mod = modifier ?? 0
  const terms: string[] = []

  if (attributeKey || attributeLabel) {
    terms.push(`${attributeLabel || t('mechanics.attributeValue')} ${attributeValue ?? 0}`)
  }
  if (skillKey || skillLabel) {
    terms.push(`${skillLabel || t('mechanics.skillValue')} ${skillValue ?? 0}`)
  }
  const modStr = mod > 0 ? `+${mod}` : String(mod)
  terms.push(`${t('mechanics.modifier')} ${modStr}`)

  if (terms.length === 0 || poolTotal == null) return null

  return (
    <p className="mt-1.5 text-[11px] font-mono text-ink-muted leading-snug">
      {terms.join(' + ')}
      <span className="text-ink-faint">
        {' '}= {poolTotal}{' '}
        <span className="text-ink-faint/70">({t('mechanics.diceCount', { count: poolTotal })})</span>
      </span>
    </p>
  )
}

interface Props {
  data: Record<string, unknown>
  heroName: string
  canReroll?: boolean
  onReroll?: () => void
}

export default function DiceRollCard({ data, heroName, canReroll, onReroll }: Props) {
  const { t } = useTranslation()
  const label = data.label as string
  const skillKey = data.skillKey as string | undefined
  const skillLabel = data.skillLabel as string | undefined
  const skillValue = data.skillValue as number | undefined
  const attributeKey = data.attributeKey as string | undefined
  const attributeLabel = data.attributeLabel as string | undefined
  const attributeValue = data.attributeValue as number | undefined
  const modifier = data.modifier as number | undefined
  const poolTotal = data.total as number | undefined
  const storedResult = data.result as number | undefined
  const rolls = (data.rolls as number[] | undefined) ?? (storedResult != null ? [storedResult] : [])

  return (
    <div className="group/dice relative mt-1 w-full max-w-full rounded-lg border border-border border-l-2 border-l-blood/40 bg-elevated px-3 py-2.5">
      {canReroll && onReroll && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onReroll()
          }}
          className="absolute top-2 right-2 rounded p-1 text-ink-faint opacity-0 transition-opacity hover:bg-void hover:text-ink group-hover/dice:opacity-100"
          title={t('chat.rollAgain')}
          aria-label={t('chat.rollAgain')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
          </svg>
        </button>
      )}

      <div className="flex items-start justify-between gap-2 pr-6">
        <span className="min-w-0 font-heading text-sm text-ink tracking-wide truncate">{label}</span>
        <span className="shrink-0 text-[10px] font-mono text-ink-faint truncate max-w-[45%]">{heroName}</span>
      </div>

      <RollPoolLine
        attributeKey={attributeKey}
        attributeLabel={attributeLabel}
        attributeValue={attributeValue}
        skillKey={skillKey}
        skillLabel={skillLabel}
        skillValue={skillValue}
        modifier={modifier}
        poolTotal={poolTotal}
      />

      {rolls.length === 0 ? (
        <p className="mt-2 font-mono text-sm text-ink-faint">—</p>
      ) : (
        <GroupedRollList rolls={rolls} />
      )}

    </div>
  )
}
