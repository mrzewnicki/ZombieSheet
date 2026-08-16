import type { GearTraitPolarity } from '@/types'

export interface SettlementPropertyTag {
  polarity: GearTraitPolarity
  /** Property name without trailing rank. */
  name: string
  /** Rank / intensity; omit from UI when 1. */
  value: number
}

/**
 * Parse system property strings like:
 * "−Wrażliwy na wilgoć1 −Łatwopalny1" or "✚Wielofunkcyjny −Łatwopalny3"
 */
export function parseSettlementProperties(raw: string): SettlementPropertyTag[] {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === '-') return []

  return trimmed
    .split(/(?=[✚+−-])/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const positive = part.startsWith('✚') || part.startsWith('+')
      const body = part.replace(/^[✚+−-]+/, '').trim()
      const match = body.match(/^(.*?)(\d+)$/)
      const name = (match?.[1] ?? body).trim()
      const value = match ? Number(match[2]) : 1
      return {
        polarity: (positive ? 'positive' : 'negative') as GearTraitPolarity,
        name,
        value: Number.isFinite(value) ? value : 1,
      }
    })
    .filter((tag) => tag.name.length > 0)
}

/** Property label without polarity glyph (color encodes +/-). */
export function settlementPropertyLabel(tag: SettlementPropertyTag): string {
  return tag.name
}

/** Show rank only when above the default of 1. */
export function settlementPropertyDisplayValue(tag: SettlementPropertyTag): number | undefined {
  return tag.value > 1 ? tag.value : undefined
}
