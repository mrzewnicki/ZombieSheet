import { useTranslation } from 'react-i18next'
import type { ArmorItem, GearTraitDefinition, WeaponItem } from '@/types'
import GearItemVisual from '@/components/hero/GearItemVisual'
import GearStatChip from '@/components/hero/GearStatChip'
import GearTraitChips from '@/components/hero/GearTraitChips'
import Button from '@/components/ui/Button'
import { hasGearThumbnail } from '@/utils/gearVisual'

type PickItem = ArmorItem | WeaponItem

interface Props {
  open: boolean
  title: string
  subtitle?: string
  items: PickItem[]
  currentId: string | null
  kind: 'armor' | 'weapon'
  traitCatalog: GearTraitDefinition[]
  onPick: (item: PickItem) => void
  onUnequip: () => void
  onClose: () => void
  busy?: boolean
}

export default function CombatSlotPicker({
  open,
  title,
  subtitle,
  items,
  currentId,
  kind,
  traitCatalog,
  onPick,
  onUnequip,
  onClose,
  busy = false,
}: Props) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="combat-slot-picker-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[min(80vh,36rem)] flex flex-col bg-surface border border-border rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <h3 id="combat-slot-picker-title" className="font-heading text-lg text-ink">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-ink-faint mt-1">{subtitle}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-ink-faint text-center py-8">
              {t('combat.pickerEmpty')}
            </p>
          ) : (
            items.map((item) => {
              const selected = item.id === currentId
              const armor = kind === 'armor' ? item as ArmorItem : null
              const weapon = kind === 'weapon' ? item as WeaponItem : null
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onPick(item)}
                  className={`
                    w-full text-left flex items-start gap-3 rounded-lg border px-3 py-2.5
                    transition-colors
                    ${selected
                      ? 'border-blood/50 bg-blood/10'
                      : 'border-border bg-void/40 hover:bg-elevated/50'}
                    disabled:opacity-50
                  `}
                >
                  {hasGearThumbnail(item) ? (
                    <div className="shrink-0 scale-75 origin-top-left -mb-2">
                      <GearItemVisual
                        imageUrl={item.imageUrl}
                        icon={item.icon}
                        color={item.color}
                        label={item.name}
                      />
                    </div>
                  ) : (
                    <span className="w-10 h-10 shrink-0 rounded border border-border bg-elevated" />
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm text-ink font-medium truncate">{item.name}</p>
                    <div className="flex flex-wrap gap-1">
                      {armor && (
                        <GearStatChip>
                          {t('inventory.list.armorChip', { value: armor.armorValue })}
                        </GearStatChip>
                      )}
                      {weapon && (
                        <>
                          <GearStatChip>{t(`inventory.weapons.type.${weapon.type}`)}</GearStatChip>
                          {weapon.damageExpression && (
                            <GearStatChip accent>{weapon.damageExpression}</GearStatChip>
                          )}
                        </>
                      )}
                      {item.inUse && (
                        <GearStatChip accent>{t('inventory.inUse')}</GearStatChip>
                      )}
                      <GearTraitChips
                        traitIds={item.traitIds}
                        traitValues={item.traitValues}
                        catalog={traitCatalog}
                      />
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-between gap-2 shrink-0">
          <Button
            variant="ghost"
            onClick={onUnequip}
            disabled={busy || !currentId}
            className="text-blood hover:text-blood-light"
          >
            {t('combat.unequip')}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  )
}
