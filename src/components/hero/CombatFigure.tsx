import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import type {
  ArmorCategory,
  ArmorItem,
  GearTraitDefinition,
  WeaponItem,
} from '@/types'
import GearIcon from '@/components/hero/GearIcon'
import GearItemVisual from '@/components/hero/GearItemVisual'
import GearStatChip from '@/components/hero/GearStatChip'
import GearTraitChips from '@/components/hero/GearTraitChips'
import { hasRenderableGearIcon } from '@/utils/gearIcons'
import { hasGearThumbnail } from '@/utils/gearVisual'
import { resolveArmorCategory } from '@/config/armorSlots'

export type CombatArmorSlotRef = {
  kind: 'armor'
  category: ArmorCategory
  index: number
}

export type CombatWeaponSlotRef = {
  kind: 'weapon'
  index: number
}

export type CombatSlotRef = CombatArmorSlotRef | CombatWeaponSlotRef

type ArmorSlotView = CombatArmorSlotRef & {
  item: ArmorItem | null
  label: string
}

type WeaponSlotView = CombatWeaponSlotRef & {
  item: WeaponItem | null
  label: string
}

type TooltipSide = 'left' | 'right' | 'top' | 'bottom'

interface Props {
  armorSlots: ArmorSlotView[]
  weaponSlots: WeaponSlotView[]
  traitCatalog: GearTraitDefinition[]
  canEdit: boolean
  onSlotClick: (slot: CombatSlotRef) => void
}

function tooltipPositionClass(side: TooltipSide): string {
  switch (side) {
    case 'left':
      return 'right-full top-1/2 -translate-y-1/2 pr-2'
    case 'right':
      return 'left-full top-1/2 -translate-y-1/2 pl-2'
    case 'top':
      return 'bottom-full left-1/2 -translate-x-1/2 pb-2'
    case 'bottom':
    default:
      return 'top-full left-1/2 -translate-x-1/2 pt-2'
  }
}

function SlotTooltip({
  item,
  kind,
  traitCatalog,
  side,
}: {
  item: ArmorItem | WeaponItem
  kind: 'armor' | 'weapon'
  traitCatalog: GearTraitDefinition[]
  side: TooltipSide
}) {
  const { t } = useTranslation()
  const armor = kind === 'armor' ? item as ArmorItem : null
  const weapon = kind === 'weapon' ? item as WeaponItem : null
  const description = item.description?.trim()

  return (
    <div
      className={`
        absolute z-[300] ${tooltipPositionClass(side)}
        pointer-events-none group-hover/slot:pointer-events-auto
        opacity-0 group-hover/slot:opacity-100
        scale-95 group-hover/slot:scale-100
        transition-[opacity,transform] duration-150
      `}
    >
      <div className="w-56 sm:w-64 px-3 py-2.5 rounded border border-border bg-void text-xs text-ink-muted leading-snug shadow-xl">
        <div className="flex items-start gap-2 mb-1.5">
          {hasGearThumbnail(item) && (
            <div className="shrink-0 scale-[0.55] origin-top-left -mb-5 -mr-6">
              <GearItemVisual
                imageUrl={item.imageUrl}
                icon={item.icon}
                color={item.color}
                label={item.name}
              />
            </div>
          )}
          <p className="text-ink font-medium text-sm min-w-0 flex-1 pt-0.5">{item.name}</p>
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {armor && (
            <>
              <GearStatChip>
                {t(`inventory.armor.categories.${resolveArmorCategory(armor)}`)}
              </GearStatChip>
              <GearStatChip>
                {t('inventory.list.armorChip', { value: armor.armorValue })}
              </GearStatChip>
            </>
          )}
          {weapon && (
            <>
              <GearStatChip>{t(`inventory.weapons.type.${weapon.type}`)}</GearStatChip>
              {weapon.damageExpression && (
                <GearStatChip accent>{weapon.damageExpression}</GearStatChip>
              )}
              <GearStatChip>×{weapon.qty}</GearStatChip>
            </>
          )}
          <GearTraitChips
            traitIds={item.traitIds}
            traitValues={item.traitValues}
            catalog={traitCatalog}
          />
        </div>
        {description ? (
          <div className="prose-hero text-[11px] text-ink-faint max-h-28 overflow-y-auto [&_p]:mb-1 [&_p:last-child]:mb-0">
            <ReactMarkdown
              rehypePlugins={[rehypeRaw, rehypeSanitize]}
              remarkPlugins={[remarkGfm]}
            >
              {description}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-ink-faint italic">{t('combat.tooltipNoDescription')}</p>
        )}
      </div>
    </div>
  )
}

function SlotButton({
  item,
  kind,
  emptyLabel,
  accent,
  disabled,
  onClick,
  style,
  traitCatalog,
  tooltipSide,
}: {
  item: ArmorItem | WeaponItem | null
  kind: 'armor' | 'weapon'
  emptyLabel: string
  accent?: string
  disabled?: boolean
  onClick: () => void
  style: React.CSSProperties
  traitCatalog: GearTraitDefinition[]
  tooltipSide: TooltipSide
}) {
  const filled = Boolean(item)
  const showIcon = hasRenderableGearIcon(item?.icon ?? '')
  const imageUrl = item?.imageUrl?.trim() ?? ''
  const showImage = Boolean(imageUrl)
  const itemName = item?.name

  return (
    <div
      className="absolute group/slot hover:!z-[200] focus-within:!z-[200]"
      style={style}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        title={filled ? undefined : emptyLabel}
        className={`
          relative z-10 flex flex-col items-center justify-center gap-0
          w-12 h-12 sm:w-14 sm:h-14 rounded-md border text-center px-0.5
          transition-colors shadow-sm shadow-void/40
          ${filled
            ? 'bg-elevated/95 border-blood/45 text-ink'
            : 'bg-void/75 border-dashed border-border text-ink-faint'}
          ${disabled
            ? 'cursor-default opacity-80'
            : 'hover:border-blood-light hover:bg-elevated cursor-pointer'}
        `}
      >
        {showIcon || showImage ? (
          <span className="flex items-center justify-center gap-0.5 leading-none">
            {showIcon && (
              <GearIcon value={item!.icon} className="text-base sm:text-lg leading-none" />
            )}
            {showImage && (
              <img
                src={imageUrl}
                alt=""
                className="w-4 h-4 sm:w-5 sm:h-5 rounded-sm object-cover border border-border/60"
                onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
              />
            )}
          </span>
        ) : !filled ? (
          <span className={`text-[9px] font-mono uppercase tracking-wide leading-none ${accent ?? ''}`}>
            +
          </span>
        ) : null}
        <span className="text-[9px] sm:text-[10px] leading-tight line-clamp-2 w-full mt-0.5">
          {itemName || emptyLabel}
        </span>
      </button>
      {item && (
        <SlotTooltip
          item={item}
          kind={kind}
          traitCatalog={traitCatalog}
          side={tooltipSide}
        />
      )}
    </div>
  )
}

const SILHOUETTE_SRC = `${import.meta.env.BASE_URL}icons/combat/silhouette.png`

/** SVG Repo standing body silhouette, tinted for dark UI via CSS mask. */
function BodySilhouette() {
  return (
    <div className="relative w-full h-full" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(165deg, #9a8b6e 0%, #7a6f5a 28%, #5a4f42 62%, #3a3025 100%)',
          WebkitMaskImage: `url(${SILHOUETTE_SRC})`,
          maskImage: `url(${SILHOUETTE_SRC})`,
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center bottom',
          maskPosition: 'center bottom',
        }}
      />
      <div
        className="absolute inset-0 opacity-40 mix-blend-soft-light pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 45% 55% at 50% 35%, #b02020 0%, transparent 70%)',
          WebkitMaskImage: `url(${SILHOUETTE_SRC})`,
          maskImage: `url(${SILHOUETTE_SRC})`,
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center bottom',
          maskPosition: 'center bottom',
        }}
      />
    </div>
  )
}

export default function CombatFigure({
  armorSlots,
  weaponSlots,
  traitCatalog,
  canEdit,
  onSlotClick,
}: Props) {
  const { t } = useTranslation()

  const main = armorSlots.filter((s) => s.category === 'main')
  const supplementary = armorSlots.filter((s) => s.category === 'supplementary')
  const clothing = armorSlots.filter((s) => s.category === 'clothing')

  return (
    <div className="relative mx-auto w-[min(100%,28rem)] aspect-square select-none pt-3 sm:pt-4 overflow-visible">
      <div className="absolute inset-[4%] sm:inset-[5%] top-[8%] sm:top-[9%]">
        <BodySilhouette />
      </div>

      {main.map((slot, i) => (
        <SlotButton
          key={`main-${slot.index}`}
          item={slot.item}
          kind="armor"
          emptyLabel={slot.label}
          accent="text-blood-light"
          disabled={!canEdit}
          onClick={() => onSlotClick(slot)}
          traitCatalog={traitCatalog}
          tooltipSide="bottom"
          style={{
            top: `${22 + i * 8}%`,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
          }}
        />
      ))}

      {supplementary.map((slot, i) => (
        <SlotButton
          key={`supp-${slot.index}`}
          item={slot.item}
          kind="armor"
          emptyLabel={slot.label}
          disabled={!canEdit}
          onClick={() => onSlotClick(slot)}
          traitCatalog={traitCatalog}
          tooltipSide="bottom"
          style={{
            top: `${40 + i * 8}%`,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
          }}
        />
      ))}

      {clothing.map((slot, i) => {
        const count = Math.max(clothing.length, 1)
        const offset = (i - (count - 1) / 2) * 3.75
        return (
          <SlotButton
            key={`cloth-${slot.index}`}
            item={slot.item}
            kind="armor"
            emptyLabel={slot.label}
            disabled={!canEdit}
            onClick={() => onSlotClick(slot)}
            traitCatalog={traitCatalog}
            tooltipSide="top"
            style={{
              top: '56%',
              left: '50%',
              transform: `translateX(calc(-50% + ${offset}rem))`,
              zIndex: 10,
            }}
          />
        )
      })}

      {weaponSlots.map((slot, i) => (
        <SlotButton
          key={`weapon-${slot.index}`}
          item={slot.item}
          kind="weapon"
          emptyLabel={slot.label}
          disabled={!canEdit}
          onClick={() => onSlotClick(slot)}
          traitCatalog={traitCatalog}
          tooltipSide={i === 0 ? 'right' : 'left'}
          style={{
            top: '48%',
            left: i === 0 ? '18%' : undefined,
            right: i === 1 ? '18%' : undefined,
            zIndex: 25,
          }}
        />
      ))}

      <p className="absolute bottom-0 left-0 right-0 text-center text-[10px] text-ink-faint font-mono">
        {canEdit ? t('combat.figureHint') : t('combat.figureReadOnly')}
      </p>
    </div>
  )
}

export const WEAPON_HAND_SLOTS = 2
