import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import SearchableSelect, { type SearchableSelectOption } from '@/components/ui/SearchableSelect'
import StepperInput from '@/components/ui/StepperInput'

export interface FormulaPart {
  label: string
  value: number
  show: boolean
}

interface Props {
  attributeKey: string
  onAttributeChange: (value: string) => void
  attributeOptions: SearchableSelectOption[]
  skillKey: string
  onSkillChange: (value: string) => void
  skillOptions: SearchableSelectOption[]
  modifier: string
  onModifierChange: (value: string) => void
  formulaParts: FormulaPart[]
  total: number
  onClose: () => void
  onThrow: () => void
}

function DiceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-blood/60 shrink-0">
      <path d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5zm2.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm9 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-4.5 4.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-4.5 4.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm9 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
    </svg>
  )
}

function StatPicker({
  label,
  value,
  onChange,
  options,
  searchPlaceholder,
  noneLabel,
  noResultsLabel,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  searchPlaceholder: string
  noneLabel: string
  noResultsLabel: string
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">{label}</span>
      <SearchableSelect
        value={value}
        onChange={onChange}
        options={options}
        noneLabel={noneLabel}
        noResultsLabel={noResultsLabel}
        searchPlaceholder={searchPlaceholder}
      />
    </div>
  )
}

export default function ThrowDialogContent({
  attributeKey,
  onAttributeChange,
  attributeOptions,
  skillKey,
  onSkillChange,
  skillOptions,
  modifier,
  onModifierChange,
  formulaParts,
  total,
  onClose,
  onThrow,
}: Props) {
  const { t } = useTranslation()
  const visibleParts = formulaParts.filter((p) => p.show)

  return (
    <>
      <div className="space-y-2.5">
        <StatPicker
          label={t('mechanics.chooseAttribute')}
          value={attributeKey}
          onChange={onAttributeChange}
          options={attributeOptions}
          searchPlaceholder={t('mechanics.searchAttribute')}
          noneLabel={t('mechanics.none')}
          noResultsLabel={t('mechanics.noResults')}
        />
        <StatPicker
          label={t('mechanics.chooseSkill')}
          value={skillKey}
          onChange={onSkillChange}
          options={skillOptions}
          searchPlaceholder={t('mechanics.searchSkill')}
          noneLabel={t('mechanics.none')}
          noResultsLabel={t('mechanics.noResults')}
        />

        <div className="rounded-lg border border-blood/25 bg-void px-3 py-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <DiceIcon />
            <span className="font-mono text-3xl font-bold text-blood-light tabular-nums leading-none">{total}</span>
          </div>
          <p className="mt-1 text-[11px] font-mono uppercase tracking-wider text-ink-faint">
            {t('mechanics.diceCount', { count: total })}
          </p>
          {visibleParts.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1 text-xs font-mono">
              {visibleParts.map((part, i) => (
                <Fragment key={part.label}>
                  {i > 0 && <span className="text-ink-faint/60 px-0.5">+</span>}
                  <span
                    title={part.label}
                    className="inline-flex items-center gap-1 rounded border border-border bg-elevated/60 px-1.5 py-0.5 tabular-nums"
                  >
                    <span className="text-[10px] text-ink-faint max-w-[4.5rem] truncate">{part.label}</span>
                    <span className="text-ink font-semibold">{part.value}</span>
                  </span>
                </Fragment>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-0.5">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">{t('mechanics.modifier')}</span>
          <StepperInput
            value={modifier}
            onChange={onModifierChange}
            decreaseLabel={t('mechanics.decrease')}
            increaseLabel={t('mechanics.increase')}
          />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border space-y-2">
        <Button onClick={onThrow} className="w-full text-sm py-2">
          {t('mechanics.throwWithCount', { count: total })}
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="w-full text-xs text-ink-faint hover:text-ink transition-colors py-1"
        >
          {t('common.cancel')}
        </button>
      </div>
    </>
  )
}
