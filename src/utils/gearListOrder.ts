export interface GearListSortable {
  name: string
  sortOrder?: number
}

export function nextGearSortOrder(items: GearListSortable[]): number {
  if (items.length === 0) return 1
  return Math.max(...items.map((i) => i.sortOrder ?? 0)) + 1
}

export function sortGearListItems<T extends GearListSortable>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    if (orderDiff !== 0) return orderDiff
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

export function assignGearSortOrders<T>(items: T[]): Array<T & { sortOrder: number }> {
  return items.map((item, index) => ({ ...item, sortOrder: index + 1 }))
}
