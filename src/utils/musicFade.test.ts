import { describe, expect, it } from 'vitest'
import {
  MUSIC_FADE_IN_MS,
  MUSIC_SILENCE_BEFORE_FADE_MS,
  fadeInGain,
  shouldFadeInAfterSilence,
} from '@/utils/musicFade'

describe('shouldFadeInAfterSilence', () => {
  it('fades when nothing was ever active', () => {
    expect(shouldFadeInAfterSilence(null, 10_000)).toBe(true)
    expect(shouldFadeInAfterSilence(undefined, 10_000)).toBe(true)
  })

  it('does not fade when silence is shorter than threshold', () => {
    const now = MUSIC_SILENCE_BEFORE_FADE_MS
    expect(shouldFadeInAfterSilence(now - 60_000, now)).toBe(false)
  })

  it('fades when silence reaches the threshold', () => {
    const now = 1_000_000
    expect(shouldFadeInAfterSilence(now - MUSIC_SILENCE_BEFORE_FADE_MS, now)).toBe(true)
    expect(shouldFadeInAfterSilence(now - MUSIC_SILENCE_BEFORE_FADE_MS - 1, now)).toBe(true)
  })
})

describe('fadeInGain', () => {
  it('starts at 0 and reaches 1 at duration', () => {
    expect(fadeInGain(0)).toBe(0)
    expect(fadeInGain(-10)).toBe(0)
    expect(fadeInGain(MUSIC_FADE_IN_MS / 2)).toBeCloseTo(0.5)
    expect(fadeInGain(MUSIC_FADE_IN_MS)).toBe(1)
    expect(fadeInGain(MUSIC_FADE_IN_MS + 100)).toBe(1)
  })
})
