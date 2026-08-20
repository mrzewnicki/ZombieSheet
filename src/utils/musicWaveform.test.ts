import { describe, expect, it } from 'vitest'
import { normalizeWaveformPeaks, peaksFromAudioBuffer, rmsFromAudioBuffer } from '@/utils/musicWaveform'

function fakeBuffer(samples: Float32Array, channels = 1): AudioBuffer {
  const chans = Array.from({ length: channels }, (_, i) =>
    i === 0 ? samples : new Float32Array(samples.length),
  )
  return {
    length: samples.length,
    numberOfChannels: channels,
    sampleRate: 44100,
    duration: samples.length / 44100,
    getChannelData: (c: number) => chans[c] ?? samples,
  } as unknown as AudioBuffer
}

describe('peaksFromAudioBuffer', () => {
  it('normalizes peaks to 0–1 across buckets', () => {
    const samples = new Float32Array(100)
    for (let i = 0; i < 50; i++) samples[i] = 0.2
    for (let i = 50; i < 100; i++) samples[i] = 1
    const peaks = peaksFromAudioBuffer(fakeBuffer(samples), 4)
    expect(peaks).toHaveLength(4)
    expect(Math.max(...peaks)).toBe(1)
    expect(peaks[0]).toBeLessThan(peaks[3])
  })
})

describe('rmsFromAudioBuffer', () => {
  it('returns higher RMS for louder samples', () => {
    const quiet = new Float32Array(100).fill(0.1)
    const loud = new Float32Array(100).fill(0.5)
    expect(rmsFromAudioBuffer(fakeBuffer(loud))).toBeGreaterThan(rmsFromAudioBuffer(fakeBuffer(quiet)))
  })
})

describe('normalizeWaveformPeaks', () => {
  it('rejects short or invalid arrays', () => {
    expect(normalizeWaveformPeaks(null)).toBeUndefined()
    expect(normalizeWaveformPeaks([0.5])).toBeUndefined()
  })

  it('clamps values', () => {
    expect(normalizeWaveformPeaks([-1, 2, 0.5])).toEqual([0, 1, 0.5])
  })
})
