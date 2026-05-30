import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ATTRIBUTE_GROUPS, SKILL_CATEGORIES } from '@/config/rpg-system'
import DraggablePanel from '@/components/ui/DraggablePanel'
import ThrowDialogContent from '@/components/hero/ThrowDialogContent'
import { useThrowDialogKeyboard } from '@/hooks/useThrowDialogKeyboard'
import { computeThrowTotal } from '@/utils/throwTotal'

const ALL_ATTRIBUTES = ATTRIBUTE_GROUPS.flatMap((g) => g.attributes)
const ALL_SKILLS = SKILL_CATEGORIES.flatMap((c) => c.skills)

export interface ThrowParams {
  skillKey: string
  skillLabel: string
  skillValue: number
  attributeKey: string
  attributeLabel: string
  attributeValue: number
  modifier: number
  total: number
}

export interface ThrowDialogInitial {
  skillKey?: string
  attributeKey?: string
}

interface Props {
  open: boolean
  initial: ThrowDialogInitial | null
  skills: Record<string, number>
  attributes: Record<string, number>
  onClose: () => void
  onThrow: (params: ThrowParams) => void
}

export default function ThrowDialog({
  open,
  initial,
  skills,
  attributes,
  onClose,
  onThrow,
}: Props) {
  const { t } = useTranslation()
  const [skillKey, setSkillKey] = useState('')
  const [attributeKey, setAttributeKey] = useState('')
  const [modifier, setModifier] = useState('0')

  useEffect(() => {
    if (!open) return
    setSkillKey(initial?.skillKey ?? '')
    setAttributeKey(initial?.attributeKey ?? '')
    setModifier('0')
  }, [open, initial?.skillKey, initial?.attributeKey])

  const hasSkill = skillKey !== ''
  const hasAttribute = attributeKey !== ''
  const skillValue = hasSkill ? (skills[skillKey] ?? 0) : 0
  const attributeValue = hasAttribute ? (attributes[attributeKey] ?? 0) : 0
  const skillLabel = hasSkill ? t(`skills.${skillKey}`, { defaultValue: skillKey }) : ''
  const attributeLabel = hasAttribute ? t(`attributes.${attributeKey}`, { defaultValue: attributeKey }) : ''
  const modifierNum = Number(modifier) || 0
  const total = computeThrowTotal(skillValue, attributeValue, modifierNum)

  const attributeOptions = ALL_ATTRIBUTES.map((attr) => ({
    value: attr.key,
    label: t(attr.labelKey),
    detail: attributes[attr.key] ?? 0,
  }))
  const skillOptions = ALL_SKILLS.map((skill) => ({
    value: skill.key,
    label: t(skill.labelKey),
    detail: skills[skill.key] ?? 0,
  }))

  function handleThrow() {
    onThrow({
      skillKey,
      skillLabel,
      skillValue,
      attributeKey,
      attributeLabel,
      attributeValue,
      modifier: modifierNum,
      total,
    })
  }

  useThrowDialogKeyboard(open, onClose, handleThrow)

  const resetKey = `${initial?.skillKey ?? ''}-${initial?.attributeKey ?? ''}`

  return (
    <DraggablePanel open={open} title={t('mechanics.rollTitle')} resetKey={resetKey}>
      <ThrowDialogContent
        attributeKey={attributeKey}
        onAttributeChange={setAttributeKey}
        attributeOptions={attributeOptions}
        skillKey={skillKey}
        onSkillChange={setSkillKey}
        skillOptions={skillOptions}
        modifier={modifier}
        onModifierChange={setModifier}
        formulaParts={[
          { label: attributeLabel, value: attributeValue, show: hasAttribute },
          { label: skillLabel, value: skillValue, show: hasSkill },
          { label: t('mechanics.modifier'), value: modifierNum, show: modifierNum !== 0 },
        ]}
        total={total}
        onClose={onClose}
        onThrow={handleThrow}
      />
    </DraggablePanel>
  )
}
