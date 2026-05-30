import type { GearVisualFields } from '@/types'
import { hasRenderableGearIcon } from '@/utils/gearIcons'

export const EMPTY_GEAR_VISUAL: GearVisualFields = {
  imageUrl: '',
  icon: '',
  color: '',
}

export function normalizeGearVisual(data: Partial<GearVisualFields>): GearVisualFields {
  return {
    imageUrl: data.imageUrl?.trim() ?? '',
    icon: data.icon?.trim() ?? '',
    color: data.color?.trim() ?? '',
  }
}

export function gearColorCss(color: string): string | undefined {
  const trimmed = color.trim()
  if (!trimmed) return undefined
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

/** #RRGGBB for native color input (alpha stripped). */
export function hexColorPickerValue(color: string): string {
  const css = gearColorCss(color)
  if (!css) return '#000000'
  const hex = css.slice(1)
  if (hex.length >= 6) return `#${hex.slice(0, 6)}`
  return '#000000'
}

function hexAlphaFromColor(color: string): string {
  const css = gearColorCss(color)
  if (!css) return 'FF'
  const hex = css.slice(1)
  if (hex.length >= 8) return hex.slice(6, 8).toUpperCase()
  return 'FF'
}

/** Merge picker RGB with existing alpha (or FF). */
export function colorFromPicker(pickerHex: string, existingColor: string): string {
  const alpha = hexAlphaFromColor(existingColor)
  const rgb = pickerHex.replace('#', '').slice(0, 6).toUpperCase()
  return `#${rgb}${alpha}`
}

export function hasGearVisual({ imageUrl, icon, color }: GearVisualFields): boolean {
  return Boolean(imageUrl || icon || color)
}

export function hasGearThumbnail({ imageUrl, icon }: Pick<GearVisualFields, 'imageUrl' | 'icon'>): boolean {
  return Boolean(imageUrl?.trim() || hasRenderableGearIcon(icon))
}

export function gearColorStripeStyle(color: string): { borderLeftColor: string } | undefined {
  const css = gearColorCss(color)
  if (!css) return undefined
  return { borderLeftColor: css }
}

export function gearVisualPayload(visual: GearVisualFields): GearVisualFields {
  return normalizeGearVisual(visual)
}
