export const MUSIC_WAVEFORM_BUCKETS = 128

const FB_STORAGE_HOST = 'https://firebasestorage.googleapis.com'
const FB_STORAGE_PROXY = '/__fb_storage'

/** In Vite dev, route Storage downloads through same-origin proxy (avoids CORS). */
export function storageUrlForFetch(downloadUrl: string): string {
  if (import.meta.env.DEV && downloadUrl.startsWith(FB_STORAGE_HOST)) {
    return `${FB_STORAGE_PROXY}${downloadUrl.slice(FB_STORAGE_HOST.length)}`
  }
  return downloadUrl
}

/** Whole-track RMS (0–1) across all channels. */
export function rmsFromAudioBuffer(buffer: AudioBuffer): number {
  const channelCount = Math.max(1, buffer.numberOfChannels)
  const length = buffer.length
  if (length <= 0) return 0
  let sum = 0
  let count = 0
  for (let c = 0; c < channelCount; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < length; i++) {
      const s = data[i] ?? 0
      sum += s * s
      count++
    }
  }
  if (count <= 0) return 0
  return Math.min(1, Math.round(Math.sqrt(sum / count) * 10000) / 10000)
}

/** Build normalized 0–1 peak buckets from an AudioBuffer (max abs across channels). */
export function peaksFromAudioBuffer(
  buffer: AudioBuffer,
  buckets: number = MUSIC_WAVEFORM_BUCKETS,
): number[] {
  const count = Math.max(2, Math.min(512, Math.trunc(buckets)))
  const length = buffer.length
  if (length <= 0) return Array.from({ length: count }, () => 0)

  const channelCount = Math.max(1, buffer.numberOfChannels)
  const channels: Float32Array[] = []
  for (let c = 0; c < channelCount; c++) {
    channels.push(buffer.getChannelData(c))
  }

  const peaks = new Array<number>(count).fill(0)
  for (let i = 0; i < count; i++) {
    const start = Math.floor((i / count) * length)
    const end = Math.floor(((i + 1) / count) * length)
    let max = 0
    for (let s = start; s < end; s++) {
      for (const ch of channels) {
        const a = Math.abs(ch[s] ?? 0)
        if (a > max) max = a
      }
    }
    peaks[i] = max
  }

  const peakMax = peaks.reduce((m, v) => (v > m ? v : m), 0)
  if (peakMax <= 0) return peaks
  return peaks.map((v) => Math.round((v / peakMax) * 1000) / 1000)
}

export function normalizeWaveformPeaks(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw) || raw.length < 2) return undefined
  const peaks: number[] = []
  for (const entry of raw) {
    if (typeof entry !== 'number' || !Number.isFinite(entry)) continue
    peaks.push(Math.min(1, Math.max(0, entry)))
  }
  return peaks.length >= 2 ? peaks : undefined
}

export async function analyzeMusicArrayBuffer(
  data: ArrayBuffer,
  buckets: number = MUSIC_WAVEFORM_BUCKETS,
): Promise<{ durationMs?: number; waveformPeaks: number[]; loudnessRms?: number }> {
  const AudioCtx =
    window.AudioContext
    || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AudioCtx()
  try {
    const buffer = await ctx.decodeAudioData(data.slice(0))
    const durationMs = Number.isFinite(buffer.duration)
      ? Math.round(buffer.duration * 1000)
      : undefined
    return {
      durationMs,
      waveformPeaks: peaksFromAudioBuffer(buffer, buckets),
      loudnessRms: rmsFromAudioBuffer(buffer) || undefined,
    }
  } catch {
    return { waveformPeaks: [] }
  } finally {
    await ctx.close().catch(() => undefined)
  }
}

/** Fetch + decode a Storage download URL (uses Vite proxy in dev to bypass CORS). */
export async function analyzeMusicDownloadUrl(
  downloadUrl: string,
  buckets: number = MUSIC_WAVEFORM_BUCKETS,
): Promise<{ durationMs?: number; waveformPeaks: number[]; loudnessRms?: number }> {
  const res = await fetch(storageUrlForFetch(downloadUrl))
  if (!res.ok) return { waveformPeaks: [] }
  return analyzeMusicArrayBuffer(await res.arrayBuffer(), buckets)
}

/**
 * Decode a local audio File once → duration + waveform peaks + loudness.
 * Uses the File blob (no Storage CORS). Returns empty peaks if decode fails.
 */
export async function analyzeMusicFile(
  file: File,
  buckets: number = MUSIC_WAVEFORM_BUCKETS,
): Promise<{ durationMs?: number; waveformPeaks: number[]; loudnessRms?: number }> {
  try {
    const result = await analyzeMusicArrayBuffer(await file.arrayBuffer(), buckets)
    if (result.waveformPeaks.length >= 2) return result
    const durationMs = result.durationMs ?? (await probeDurationMs(file))
    return { durationMs, waveformPeaks: result.waveformPeaks, loudnessRms: result.loudnessRms }
  } catch {
    const durationMs = await probeDurationMs(file)
    return { durationMs, waveformPeaks: [] }
  }
}

function probeDurationMs(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const ms = Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : undefined
      URL.revokeObjectURL(url)
      resolve(ms)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(undefined)
    }
    audio.src = url
  })
}
