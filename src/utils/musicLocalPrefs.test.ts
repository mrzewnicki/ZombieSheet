import { describe, expect, it, beforeEach } from 'vitest'
import {
  loadLocalChannelVolumes,
  saveLocalChannelVolumes,
} from '@/utils/musicLocalPrefs'

describe('musicLocalPrefs', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns defaults when empty', () => {
    expect(loadLocalChannelVolumes('g1', 'u1')).toEqual({
      ambient: 1,
      music: 1,
      effects: 1,
    })
  })

  it('persists and reloads volumes', () => {
    saveLocalChannelVolumes('g1', 'u1', {
      ambient: 0.2,
      music: 0.5,
      effects: 0.8,
    })
    expect(loadLocalChannelVolumes('g1', 'u1')).toEqual({
      ambient: 0.2,
      music: 0.5,
      effects: 0.8,
    })
  })
})
