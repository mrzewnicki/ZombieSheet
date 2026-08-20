import { describe, expect, it } from 'vitest'
import {
  computePositionMs,
  idlePlaybackState,
  nextPlaylistIndex,
  stepPlaylistIndex,
  normalizeMusicPlaybackState,
  clampTrackVolume,
  loudnessMatchGain,
  normalizeChannelLoudnessTarget,
  DEFAULT_LOUDNESS_TARGET,
} from '@/utils/musicPlayback'

describe('normalizeMusicPlaybackState', () => {
  it('returns idle defaults for missing data', () => {
    expect(normalizeMusicPlaybackState('ambient', null)).toEqual(idlePlaybackState('ambient'))
  })

  it('normalizes a playing state', () => {
    const state = normalizeMusicPlaybackState('music', {
      status: 'playing',
      source: 'playlist',
      trackId: 't1',
      playlistId: 'p1',
      playlistIndex: 2,
      loopMode: 'playlist',
      trackVolume: 0.5,
      positionMs: 1200,
    })
    expect(state.status).toBe('playing')
    expect(state.playlistIndex).toBe(2)
    expect(state.trackVolume).toBe(0.5)
  })
})

describe('computePositionMs', () => {
  it('returns positionMs when paused/idle', () => {
    expect(computePositionMs({ status: 'paused', positionMs: 5000, startedAt: null })).toBe(5000)
  })

  it('adds elapsed time when playing', () => {
    const startedAt = { toMillis: () => 1000 }
    expect(
      computePositionMs(
        { status: 'playing', positionMs: 2000, startedAt: startedAt as never },
        4000,
      ),
    ).toBe(5000)
  })
})

describe('nextPlaylistIndex', () => {
  it('advances and wraps on playlist loop', () => {
    expect(nextPlaylistIndex(['a', 'b'], 0, 'off')).toBe(1)
    expect(nextPlaylistIndex(['a', 'b'], 1, 'off')).toBeNull()
    expect(nextPlaylistIndex(['a', 'b'], 1, 'playlist')).toBe(0)
  })
})

describe('stepPlaylistIndex', () => {
  it('steps and wraps both ways', () => {
    expect(stepPlaylistIndex(['a', 'b', 'c'], 0, 1)).toBe(1)
    expect(stepPlaylistIndex(['a', 'b', 'c'], 2, 1)).toBe(0)
    expect(stepPlaylistIndex(['a', 'b', 'c'], 0, -1)).toBe(2)
  })
})

describe('volume and loudness', () => {
  it('clamps volumes', () => {
    expect(clampTrackVolume(1.5)).toBe(1)
    expect(clampTrackVolume(-1)).toBe(0)
  })

  it('matches loud tracks down toward target', () => {
    expect(loudnessMatchGain(0.2, 0.4)).toBeCloseTo(0.5)
    expect(loudnessMatchGain(0, 0.4)).toBe(1)
    expect(loudnessMatchGain(0.2, undefined)).toBe(1)
  })

  it('reads loudness target from channel settings', () => {
    expect(normalizeChannelLoudnessTarget({ loudnessTarget: 0.35 })).toBe(0.35)
    expect(normalizeChannelLoudnessTarget(null)).toBe(DEFAULT_LOUDNESS_TARGET)
  })
})

describe('m4a content type', () => {
  it('maps m4a files to audio/mp4 storage path', async () => {
    const { musicTrackStoragePath, resolveMusicContentType, isAllowedMusicFile } = await import('@/utils/musicPlayback')
    const file = new File([new Uint8Array([1])], 'song.m4a', { type: 'audio/mp4' })
    expect(isAllowedMusicFile(file)).toBe(true)
    expect(resolveMusicContentType(file)).toBe('audio/mp4')
    expect(musicTrackStoragePath('g1', 't1', 'audio/mp4')).toBe('games/g1/music/t1.m4a')
  })
})
