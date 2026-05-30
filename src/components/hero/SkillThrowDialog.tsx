import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ATTRIBUTE_GROUPS } from '@/config/rpg-system'
import Button from '@/components/ui/Button'
import DraggablePanel from '@/components/ui/DraggablePanel'
import SearchableSelect from '@/components/ui/SearchableSelect'
import StepperInput from '@/components/ui/StepperInput'
import { useThrowDialogKeyboard } from '@/hooks/useThrowDialogKeyboard'

const ALL_ATTRIBUTES = ATTRIBUTE_GROUPS.flatMap((g) => g.attributes)

export interface SkillThrowParams {
  attributeKey: string
  attributeLabel: string
  attributeValue: number
  modifier: number
  total: number
}

interface Props {
  open: boolean
  skillLabel: string
  skillValue: number
  attributes: Record<string, number>
  onClose: () => void
  onThrow: (params: SkillThrowParams) => void
}

export default function SkillThrowDialog({
  open,
  skillLabel,
  skillValue,
  attributes,
  onClose,
  onThrow,
}: Props) {
  const { t } = useTranslation()
  const [attributeKey, setAttributeKey] = useState('')
  const [modifier, setModifier] = useState('0')

  useEffect(() => {
    if (!open) return
    setAttributeKey('')
    setModifier('0')
  }, [open, skillLabel])

  const hasAttribute = attributeKey !== ''
  const attributeValue = hasAttribute ? (attributes[attributeKey] ?? 0) : 0
  const selectedAttributeLabel = hasAttribute
    ? t(`attributes.${attributeKey}`, { defaultValue: attributeKey })
    : ''
  const modifierNum = Number(modifier) || 0
  const total = skillValue + attributeValue + modifierNum
  const attributeOptions = ALL_ATTRIBUTES.map((attr) => ({
    value: attr.key,
    label: `${t(attr.labelKey)} (${attributes[attr.key] ?? 0})`,
  }))

  function handleThrow() {
    onThrow({
      attributeKey,
      attributeLabel: selectedAttributeLabel,
      attributeValue,
      modifier: modifierNum,
      total,
    })
  }

  useThrowDialogKeyboard(open, onClose, handleThrow)

  return (
    <DraggablePanel open={open} title={t('mechanics.rollTitle')} resetKey={skillLabel}>
      <div className="space-y-3">
        <div className="flex items-baseline justify-between pb-2 border-b border-border">
          <span className="text-xs text-ink-faint font-mono tracking-wider">
            {skillLabel}
          </span>
          <span className="font-mono text-2xl font-bold text-blood-light tabular-nums">{skillValue}</span>
        </div>
        <label className="block">
          <span className="text-xs text-ink-faint font-mono uppercase tracking-wider">
            {t('mechanics.chooseAttribute')}
          </span>
          <SearchableSelect
            className="mt-1"
            value={attributeKey}
            onChange={setAttributeKey}
            options={attributeOptions}
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
              {skillValue}
              {hasAttribute && <span className="text-ink-muted"> + {attributeValue}</span>}
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
