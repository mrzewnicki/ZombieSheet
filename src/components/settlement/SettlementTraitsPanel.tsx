import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import type { SettlementTraitLine, SettlementTraitPolarity } from '@/types'
import { newSettlementTrait } from '@/utils/settlement'

interface Props {
  traits: SettlementTraitLine[]
  canEdit: boolean
  onChange: (traits: SettlementTraitLine[]) => void
}

export default function SettlementTraitsPanel({ traits, canEdit, onChange }: Props) {
  const { t } = useTranslation()

  function update(id: string, patch: Partial<SettlementTraitLine>) {
    onChange(traits.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function remove(id: string) {
    onChange(traits.filter((item) => item.id !== id))
  }

  function add(polarity: SettlementTraitPolarity) {
    onChange([...traits, newSettlementTrait(polarity)])
  }

  const atuty = traits.filter((item) => item.polarity === 'positive')
  const wady = traits.filter((item) => item.polarity === 'negative')

  function renderGroup(list: SettlementTraitLine[], polarity: SettlementTraitPolarity) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className={`text-xs font-mono uppercase tracking-widest ${
            polarity === 'positive' ? 'text-emerald-400/80' : 'text-blood'
          }`}>
            {polarity === 'positive' ? t('settlement.atuty') : t('settlement.wady')}
          </h4>
          {canEdit && (
            <Button variant="outline" className="text-[10px] py-1" onClick={() => add(polarity)}>
              {t('common.add')}
            </Button>
          )}
        </div>
        {list.length === 0 ? (
          <p className="text-xs text-ink-faint">{t('settlement.noTraits')}</p>
        ) : (
          list.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-void/40 px-3 py-2 space-y-2">
              {canEdit ? (
                <>
                  <div className="flex gap-2">
                    <Input
                      value={item.name}
                      onChange={(e) => update(item.id, { name: e.target.value })}
                      placeholder={t('settlement.traitName')}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={item.value}
                      onChange={(e) => update(item.id, { value: Number(e.target.value) || 0 })}
                      className="w-16"
                      aria-label={t('settlement.traitValue')}
                    />
                  </div>
                  <textarea
                    value={item.description}
                    onChange={(e) => update(item.id, { description: e.target.value })}
                    placeholder={t('settlement.traitDescription')}
                    rows={2}
                    className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink resize-y min-h-[2.5rem]"
                  />
                  <Button variant="danger" className="text-[10px] py-1" onClick={() => remove(item.id)}>
                    {t('common.delete')}
                  </Button>
                </>
              ) : (
                <div>
                  <p className="text-sm text-ink font-medium">
                    {item.name || t('settlement.unnamedTrait')}
                    {item.value > 0 && <span className="text-ink-faint font-mono"> ({item.value})</span>}
                  </p>
                  {item.description && (
                    <p className="text-xs text-ink-muted mt-1 whitespace-pre-wrap">{item.description}</p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <h3 className="font-heading text-sm text-blood-light tracking-widest uppercase">
        {t('settlement.traitsSection')}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
        {renderGroup(atuty, 'positive')}
        {renderGroup(wady, 'negative')}
      </div>
    </section>
  )
}
