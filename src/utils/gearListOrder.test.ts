import { describe, expect, it } from 'vitest'
import { assignGearSortOrders, nextGearSortOrder, sortGearListItems } from '@/utils/gearListOrder'

describe('gearListOrder', () => {
  it('assigns the next sort order after existing items', () => {
    expect(nextGearSortOrder([])).toBe(1)
    expect(nextGearSortOrder([{ name: 'A' }, { name: 'B', sortOrder: 3 }])).toBe(4)
  })

  it('sorts by sortOrder and keeps legacy items before numbered ones', () => {
    const sorted = sortGearListItems([
      { name: 'New', sortOrder: 2 },
      { name: 'Beta' },
      { name: 'Alpha' },
      { name: 'Older', sortOrder: 1 },
    ])

    expect(sorted.map((item) => item.name)).toEqual(['Alpha', 'Beta', 'Older', 'New'])
  })

  it('assigns sequential sort orders', () => {
    const ordered = assignGearSortOrders([{ name: 'B' }, { name: 'A' }])
    expect(ordered.map((item) => item.sortOrder)).toEqual([1, 2])
  })
})
