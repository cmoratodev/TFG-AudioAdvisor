import { create } from 'zustand'
import type { TrackData, RepeatMode } from '@/types'

export type { TrackData }

interface PlayerState {
  currentTrack: TrackData | null
  /** Tracks eligible to play next (set by My Tracks / Explore when playback starts). */
  queue: TrackData[]
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  isShuffle: boolean
  repeatMode: RepeatMode

  /** Start playing a track. If `queue` is provided, replaces the current queue. */
  playTrack: (track: TrackData, queue?: TrackData[]) => void
  /**
   * Update the current track in place (e.g. switching between versions of the
   * same track). Preserves `isPlaying`; resets `currentTime` to 0 since the
   * audio file is changing under the hood. No-op if a different track is
   * currently active.
   */
  replaceCurrentTrack: (track: TrackData) => void
  /** Replace the playback queue without changing the current track. */
  setQueue: (tracks: TrackData[]) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeatMode: () => void
  playNext: () => void
  playPrevious: () => void
  handleEnded: () => void
  /** Stop and forget the current track (e.g. after deletion). */
  clear: () => void
}

const nextRepeatMode = (mode: RepeatMode): RepeatMode => {
  if (mode === 'off') return 'all'
  if (mode === 'all') return 'one'
  return 'off'
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  isShuffle: false,
  repeatMode: 'off',

  playTrack: (track, queue) =>
    set((state) => ({
      currentTrack: track,
      queue: queue ?? (state.queue.some((t) => t.id === track.id) ? state.queue : [track]),
      isPlaying: true,
      currentTime: 0,
    })),

  replaceCurrentTrack: (track) =>
    set((state) => {
      if (state.currentTrack?.id !== track.id) return state
      if (state.currentTrack.audioUrl === track.audioUrl) return state
      return {
        currentTrack: { ...track },
        currentTime: 0,
        duration: track.duration ?? 0,
      }
    }),

  setQueue: (queue) => set({ queue }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, volume))
    set({ volume: clamped, isMuted: clamped === 0 })
  },
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleShuffle: () => set((state) => ({ isShuffle: !state.isShuffle })),
  cycleRepeatMode: () => set((state) => ({ repeatMode: nextRepeatMode(state.repeatMode) })),

  playNext: () =>
    set((state) => {
      const { queue, currentTrack, isShuffle } = state
      if (queue.length === 0 || !currentTrack) return state

      if (isShuffle) {
        const available = queue.filter((t) => t.id !== currentTrack.id)
        const pool = available.length > 0 ? available : queue
        return {
          currentTrack: pool[Math.floor(Math.random() * pool.length)],
          isPlaying: true,
          currentTime: 0,
        }
      }

      const idx = queue.findIndex((t) => t.id === currentTrack.id)
      if (idx === -1) return state
      const nextIdx = (idx + 1) % queue.length
      return { currentTrack: queue[nextIdx], isPlaying: true, currentTime: 0 }
    }),

  playPrevious: () =>
    set((state) => {
      const { queue, currentTrack, currentTime, isShuffle } = state
      if (queue.length === 0 || !currentTrack) return state
      if (currentTime > 3) return { currentTime: 0 }

      if (isShuffle) {
        const available = queue.filter((t) => t.id !== currentTrack.id)
        const pool = available.length > 0 ? available : queue
        return {
          currentTrack: pool[Math.floor(Math.random() * pool.length)],
          isPlaying: true,
          currentTime: 0,
        }
      }

      const idx = queue.findIndex((t) => t.id === currentTrack.id)
      if (idx === -1) return state
      const prevIdx = idx === 0 ? queue.length - 1 : idx - 1
      return { currentTrack: queue[prevIdx], isPlaying: true, currentTime: 0 }
    }),

  handleEnded: () => {
    const { repeatMode, queue, currentTrack, isShuffle, playNext } = get()

    if (repeatMode === 'one') {
      set({ currentTime: 0, isPlaying: true })
      return
    }

    if (repeatMode === 'off' && !isShuffle) {
      const isLast =
        currentTrack && queue.findIndex((t) => t.id === currentTrack.id) === queue.length - 1
      if (isLast) {
        set({ isPlaying: false, currentTime: 0 })
        return
      }
    }

    playNext()
  },

  clear: () => set({ currentTrack: null, queue: [], isPlaying: false, currentTime: 0 }),
}))
