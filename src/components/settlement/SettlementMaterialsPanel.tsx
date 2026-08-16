import { useTranslation } from 'react-i18next'
import { SETTLEMENT_MATERIAL_ICONS } from '@/config/settlementMaterialIcons'
import { SETTLEMENT_MATERIALS, type SettlementMaterialKey } from '@/config/settlementMaterials'
import { gearTraitPolarityClasses } from '@/utils/gearTraits'
import TraitValueBadge from '@/components/ui/TraitValueBadge'
import {
  parseSettlementProperties,
  settlementPropertyDisplayValue,
  settlementPropertyLabel,
} from '@/utils/settlementProperties'

interface Props {
  materials: Record<string, number>
  canEdit: boolean
  onChange: (key: SettlementMaterialKey, value: number) => void
}

export default function SettlementMaterialsPanel({ materials, canEdit, onChange }: Props) {
  const { t } = useTranslation()

  return (
    <section className="space-y-3">
      <h3 className="font-heading text-sm text-blood-light tracking-widest uppercase">
        {t('settlement.materialsSection')}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {SETTLEMENT_MATERIALS.map((mat) => {
          const qty = materials[mat.key] ?? 0
          const Icon = SETTLEMENT_MATERIAL_ICONS[mat.key]
          const tags = parseSettlementProperties(mat.properties)
          return (
            <div
              key={mat.key}
              className="group relative rounded-md border border-border bg-elevated/40 px-1.5 py-0.5 flex items-center gap-1.5"
              title={`${t(mat.descriptionKey)} · ${t('settlement.materialValue')}: ${mat.value}`}
            >
              <span className="w-7 h-7 shrink-0 rounded border border-border bg-void/60 flex items-center justify-center text-blood-light">
                <Icon className="w-3.5 h-3.5" aria-hidden />
              </span>
              <p className="text-sm text-ink font-medium shrink-0">{t(mat.labelKey)}</p>

              {tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 min-w-0 flex-1">
                  {tags.map((tag) => {
                    const rank = settlementPropertyDisplayValue(tag)
                    return (
                      <span
                        key={`${tag.polarity}-${tag.name}-${tag.value}`}
                        className={`inline-flex items-center gap-1 leading-none text-[11px] font-mono pl-1.5 ${rank != null ? 'pr-1' : 'pr-1.5'} py-0.5 rounded-full border ${gearTraitPolarityClasses(tag.polarity)}`}
                      >
                        <span className="uppercase tracking-wider leading-none">
                          {settlementPropertyLabel(tag)}
                        </span>
                        {rank != null && (
                          <TraitValueBadge polarity={tag.polarity} value={rank} />
                        )}
                      </span>
                    )
                  })}
                </div>
              )}

              {tags.length === 0 && <div className="flex-1 min-w-0" />}

              {canEdit ? (
                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  <button
                    type="button"
                    onClick={() => onChange(mat.key, Math.max(0, qty - 1))}
                    className="w-6 h-6 rounded bg-void border border-border text-ink-faint hover:text-ink hover:border-blood/40 font-mono text-xs"
                  >
                    −
                  </button>
                  <span className="font-mono text-sm text-ink w-7 text-center tabular-nums">{qty}</span>
                  <button
                    type="button"
                    onClick={() => onChange(mat.key, qty + 1)}
                    className="w-6 h-6 rounded bg-void border border-border text-ink-faint hover:text-ink hover:border-blood/40 font-mono text-xs"
                  >
                    +
                  </button>
                </div>
              ) : (
                <span className="font-mono text-sm text-ink tabular-nums shrink-0 ml-auto">{qty}</span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
