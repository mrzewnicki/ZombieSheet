import raCss from 'rpg-awesome/css/rpg-awesome.css?raw'
import type { IconType } from 'react-icons'

export type GearIconSet = 'gi' | 'ra'

export interface ParsedGearIcon {
  set: GearIconSet
  id: string
}

export interface GearIconEntry {
  value: string
  label: string
  set: GearIconSet
  keywords: string
}

const RA_UTILITIES = new Set([
  'lg', '2x', '3x', '4x', '5x', 'fw', 'ul', 'li', 'border',
  'pull-left', 'pull-right', 'spin', 'pulse',
  'rotate-90', 'rotate-180', 'rotate-270',
  'flip-horizontal', 'flip-vertical',
  'stack', 'stack-1x', 'stack-2x', 'inverse',
])

const RA_SLUGS = extractRaIconSlugs(raCss)
const RA_SLUG_SET = new Set(RA_SLUGS)

let giModulePromise: Promise<typeof import('react-icons/gi')> | null = null
let catalogCache: GearIconEntry[] | null = null
let catalogPromise: Promise<GearIconEntry[]> | null = null

export function encodeGearIcon(set: GearIconSet, id: string): string {
  return `${set}:${id}`
}

export function parseGearIcon(value: string): ParsedGearIcon | null {
  const trimmed = value.trim()
  const match = trimmed.match(/^(gi|ra):(.+)$/)
  if (!match) return null
  return { set: match[1] as GearIconSet, id: match[2] }
}

function formatIconLabel(raw: string): string {
  return raw
    .replace(/^Gi/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractRaIconSlugs(css: string): string[] {
  const slugs: string[] = []
  const re = /^\.(ra-[a-z0-9-]+):before/gm
  let match: RegExpExecArray | null
  while ((match = re.exec(css)) !== null) {
    const slug = match[1].slice(3)
    if (!RA_UTILITIES.has(slug)) slugs.push(slug)
  }
  return slugs
}

function loadGiModule() {
  if (!giModulePromise) giModulePromise = import('react-icons/gi')
  return giModulePromise
}

function buildRaCatalog(): GearIconEntry[] {
  return RA_SLUGS.map((slug) => {
    const label = formatIconLabel(slug)
    return {
      value: encodeGearIcon('ra', slug),
      label,
      set: 'ra' as const,
      keywords: `${label} ${slug} rpg awesome ra`.toLowerCase(),
    }
  })
}

async function buildCatalog(): Promise<GearIconEntry[]> {
  const mod = await loadGiModule()
  const giEntries: GearIconEntry[] = Object.keys(mod)
    .filter((name) => name.startsWith('Gi') && name !== 'Gi')
    .map((name) => {
      const label = formatIconLabel(name)
      return {
        value: encodeGearIcon('gi', name),
        label,
        set: 'gi' as const,
        keywords: `${label} ${name} game icons gi`.toLowerCase(),
      }
    })

  return [...giEntries, ...buildRaCatalog()].sort((a, b) => a.label.localeCompare(b.label))
}

export function loadGearIconCatalog(): Promise<GearIconEntry[]> {
  if (catalogCache) return Promise.resolve(catalogCache)
  if (!catalogPromise) {
    catalogPromise = buildCatalog().then((catalog) => {
      catalogCache = catalog
      return catalog
    })
  }
  return catalogPromise
}

export function getGearIconCatalog(): GearIconEntry[] {
  return catalogCache ?? buildRaCatalog()
}

export function searchGearIcons(query: string, limit = 80): GearIconEntry[] {
  const q = query.trim().toLowerCase()
  const catalog = getGearIconCatalog()
  if (!q) return catalog.slice(0, limit)

  const matches: GearIconEntry[] = []
  for (const entry of catalog) {
    if (entry.keywords.includes(q)) {
      matches.push(entry)
      if (matches.length >= limit) break
    }
  }
  return matches
}

export function gearIconLabel(value: string): string {
  const parsed = parseGearIcon(value)
  if (!parsed) return value.trim()
  return formatIconLabel(parsed.id)
}

export async function loadGiIconComponent(id: string): Promise<IconType | null> {
  const mod = await loadGiModule()
  const Icon = mod[id as keyof typeof mod]
  return typeof Icon === 'function' ? Icon : null
}

export function isKnownGearIcon(value: string): boolean {
  const parsed = parseGearIcon(value)
  if (!parsed) return false
  if (parsed.set === 'ra') return RA_SLUG_SET.has(parsed.id)
  return parsed.id.startsWith('Gi')
}

export function hasRenderableGearIcon(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  const parsed = parseGearIcon(trimmed)
  if (!parsed) return true
  return isKnownGearIcon(trimmed)
}

export function getGearIconCatalogSize(): number {
  return (catalogCache?.length ?? RA_SLUGS.length)
}
