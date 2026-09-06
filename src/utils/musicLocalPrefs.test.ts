import { describe, expect, it, beforeEach } from 'vitest'
import {
  effectiveLocalVolume,
  loadLocalChannelVolumes,
  saveLocalChannelVolumes,
} from '@/utils/musicLocalPrefs'

describe('musicLocalPrefs', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns defaults when empty', () => {
    expect(loadLocalChannelVolumes('g1', 'u1')).toEqual({
      master: 1,
      muted: false,
      ambient: 1,
      music: 1,
      effects: 1,
    })
  })

  it('persists and reloads volumes for the user across games', () => {
    saveLocalChannelVolumes('g1', 'u1', {
      master: 0.7,
      muted: false,
      ambient: 0.2,
      music: 0.5,
      effects: 0.8,
    })
    expect(loadLocalChannelVolumes('g2', 'u1')).toEqual({
      master: 0.7,
      muted: false,
      ambient: 0.2,
      music: 0.5,
      effects: 0.8,
    })
  })

  it('defaults master when missing from stored prefs', () => {
    localStorage.setItem('musicLocalVol_v2_u1', JSON.stringify({
      ambient: 0.4,
      music: 0.5,
      effects: 0.6,
    }))
    expect(loadLocalChannelVolumes('g1', 'u1')).toEqual({
      master: 1,
      muted: false,
      ambient: 0.4,
      music: 0.5,
      effects: 0.6,
    })
  })

  it('clears a stuck muted flag on load', () => {
    localStorage.setItem('musicLocalVol_v2_u1', JSON.stringify({
      master: 1,
      muted: true,
      ambient: 0.5,
      music: 0.5,
      effects: 0.5,
    }))
    expect(loadLocalChannelVolumes('g1', 'u1')).toEqual({
      master: 1,
      muted: false,
      ambient: 0.5,
      music: 0.5,
      effects: 0.5,
    })
  })

  it('migrates legacy per-game prefs and restores master after mute-by-zero', () => {
    localStorage.setItem('musicLocalVol_g1_u1', JSON.stringify({
      master: 0,
      ambient: 0.1,
      music: 0.2,
      effects: 0.4,
    }))
    expect(loadLocalChannelVolumes('g1', 'u1')).toEqual({
      master: 1,
      muted: false,
      ambient: 0.1,
      music: 0.2,
      effects: 0.4,
    })
  })

  it('keeps preferred master while muted', () => {
    const volumes = {
      master: 0.55,
      muted: true,
      ambient: 1,
      music: 0.5,
      effects: 1,
    }
    expect(effectiveLocalVolume(volumes, 'music')).toBe(0)
    expect(effectiveLocalVolume({ ...volumes, muted: false }, 'music')).toBeCloseTo(0.275)
  })
})
