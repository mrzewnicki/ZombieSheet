import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { GearVisualFields } from '@/types'
import Input from '@/components/ui/Input'
import GearIconPicker from '@/components/hero/GearIconPicker'
import { gearColorCss, hexColorPickerValue, colorFromPicker } from '@/utils/gearVisual'

interface Props extends GearVisualFields {
  onChange: (patch: Partial<GearVisualFields>) => void
  variant?: 'section' | 'aside'
}

export default function GearVisualFields({
  imageUrl,
  icon,
  color,
  onChange,
  variant = 'section',
}: Props) {
  const { t } = useTranslation()
  const swatchColor = gearColorCss(color)
  const pickerValue = hexColorPickerValue(color)
  const hasColor = Boolean(color.trim())
  const isAside = variant === 'aside'
  const colorInputId = useId()

  return (
    <div
      className={
        isAside
          ? 'space-y-3 min-w-0 sm:w-72 lg:w-80 pt-3 border-t border-border sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0'
          : 'space-y-3 pt-3 border-t border-border'
      }
    >
      <p className="text-xs font-mono uppercase tracking-widest text-blood-light/80">
        {t('inventory.visual.appearance')}
      </p>

      <div className={isAside ? undefined : 'max-w-xl'}>
        <Input
          label={t('inventory.visual.imageUrl')}
          placeholder={t('inventory.visual.imageUrlPlaceholder')}
          value={imageUrl}
          onChange={(e) => onChange({ imageUrl: e.target.value })}
          type="url"
        />
      </div>

      <div className={`grid grid-cols-1 gap-4 ${isAside ? '' : 'sm:grid-cols-[9rem_1fr] sm:items-end'}`}>
        <GearIconPicker
          label={t('inventory.visual.icon')}
          value={icon}
          onChange={(next) => onChange({ icon: next })}
        />

        <div className="flex flex-col gap-1 min-w-0">
          <label
            htmlFor={colorInputId}
            className="text-xs text-ink-muted uppercase tracking-widest"
          >
            {t('inventory.visual.color')}
          </label>
          <div className="flex rounded border border-border bg-surface overflow-hidden focus-within:border-blood focus-within:ring-1 focus-within:ring-blood/40 transition-colors">
            <label
              className="relative shrink-0 w-10 border-r border-border cursor-pointer bg-elevated"
              title={t('inventory.visual.colorPicker')}
            >
              <input
                type="color"
                value={pickerValue}
                onChange={(e) => onChange({ color: colorFromPicker(e.target.value, color) })}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label={t('inventory.visual.colorPicker')}
              />
              <span
                className="pointer-events-none block w-full h-full min-h-[2.375rem]"
                style={{ backgroundColor: swatchColor ?? undefined }}
                aria-hidden
              />
            </label>
            <input
              id={colorInputId}
              type="text"
              placeholder={t('inventory.visual.colorPlaceholder')}
              value={color}
              onChange={(e) => onChange({ color: e.target.value })}
              className="flex-1 min-w-0 bg-transparent border-0 px-3 py-2 text-sm text-ink font-mono placeholder-ink-faint focus:outline-none"
            />
            {hasColor && (
              <button
                type="button"
                onClick={() => onChange({ color: '' })}
                className="shrink-0 w-9 flex items-center justify-center border-l border-border text-ink-faint hover:text-ink hover:bg-elevated transition-colors"
                aria-label={t('inventory.visual.colorClear')}
                title={t('inventory.visual.colorClear')}
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
