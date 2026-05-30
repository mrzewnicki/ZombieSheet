import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SKILL_CATEGORIES } from '@/config/rpg-system'
import Button from '@/components/ui/Button'
import DraggablePanel from '@/components/ui/DraggablePanel'
import SearchableSelect from '@/components/ui/SearchableSelect'
import StepperInput from '@/components/ui/StepperInput'
import { useThrowDialogKeyboard } from '@/hooks/useThrowDialogKeyboard'

const ALL_SKILLS = SKILL_CATEGORIES.flatMap((c) => c.skills)

export interface AttributeThrowParams {
  skillKey: string
  skillLabel: string
  skillValue: number
  modifier: number
  total: number
}

interface Props {
  open: boolean
  attributeLabel: string
  attributeValue: number
  skills: Record<string, number>
  onClose: () => void
  onThrow: (params: AttributeThrowParams) => void
}

export default function AttributeThrowDialog({
  open,
  attributeLabel,
  attributeValue,
  skills,
  onClose,
  onThrow,
}: Props) {
  const { t } = useTranslation()
  const [skillKey, setSkillKey] = useState('')
  const [modifier, setModifier] = useState('0')

  useEffect(() => {
    if (!open) return
    setSkillKey('')
    setModifier('0')
  }, [open, attributeLabel])

  const hasSkill = skillKey !== ''
  const skillValue = hasSkill ? (skills[skillKey] ?? 0) : 0
  const selectedSkillLabel = hasSkill
    ? t(`skills.${skillKey}`, { defaultValue: skillKey })
    : ''
  const modifierNum = Number(modifier) || 0
  const total = attributeValue + skillValue + modifierNum
  const skillOptions = ALL_SKILLS.map((skill) => ({
    value: skill.key,
    label: `${t(skill.labelKey)} (${skills[skill.key] ?? 0})`,
  }))

  function handleThrow() {
    onThrow({
      skillKey,
      skillLabel: selectedSkillLabel,
      skillValue,
      modifier: modifierNum,
      total,
    })
  }

  useThrowDialogKeyboard(open, onClose, handleThrow)

  return (
    <DraggablePanel open={open} title={t('mechanics.rollTitle')} resetKey={attributeLabel}>
      <div className="space-y-3">
        <div className="flex items-baseline justify-between pb-2 border-b border-border">
          <span className="text-xs text-ink-faint font-mono tracking-wider">
            {attributeLabel}
          </span>
          <span className="font-mono text-2xl font-bold text-blood-light tabular-nums">{attributeValue}</span>
        </div>
        <label className="block">
          <span className="text-xs text-ink-faint font-mono uppercase tracking-wider">
            {t('mechanics.chooseSkill')}
          </span>
          <SearchableSelect
            className="mt-1"
            value={skillKey}
            onChange={setSkillKey}
            options={skillOptions}
            noneLabel={t('mechanics.none')}
            noResultsLabel={t('mechanics.noResults')}
          />
        </label>

        <label className="block">
          <span className="text-xs text-ink-faint font-mono uppercase tracking-wider">
            {t('mechanics.modifier')}
          </span>
          <StepperInput
            className="mt-1"
            value={modifier}
            onChange={setModifier}
            decreaseLabel={t('mechanics.decrease')}
            increaseLabel={t('mechanics.increase')}
          />
        </label>

        <div className="flex flex-col gap-0.5 bg-elevated border border-border rounded px-3 py-2 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-ink-faint">{t('mechanics.total')}</span>
            <span className="text-ink tabular-nums">
              {attributeValue}
              {hasSkill && <span className="text-ink-muted"> + {skillValue}</span>}
              {modifierNum !== 0 && (
                <span className="text-ink-muted">
                  {' '}{modifierNum > 0 ? '+' : '−'} {Math.abs(modifierNum)}
                </span>
              )}
              {' '}= <span className="font-bold text-blood-light">{total}</span>
            </span>
          </div>
          <span className="text-ink-faint/70 text-[10px] text-right">
            {t('mechanics.diceCount', { count: total })}
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-5">
        <Button variant="ghost" onClick={onClose} className="text-xs">
          {t('common.cancel')}
        </Button>
        <Button onClick={handleThrow} className="text-xs">
          {t('mechanics.throw')}
        </Button>
      </div>
    </DraggablePanel>
  )
}
