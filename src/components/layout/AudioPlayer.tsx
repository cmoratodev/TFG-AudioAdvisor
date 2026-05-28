'use client';

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';

const GLOBAL_AUDIO_ID = 'global-audio-player';

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const parseSliderValue = (val: number | readonly number[]): number | null => {
  const raw = Array.isArray(val) ? val[0] : (val as number);
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
};

export function AudioPlayer() {
  const {
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    currentTime,
    duration,
    repeatMode,
    isShuffle,
    togglePlay,
    setVolume,
    toggleMute,
    playNext,
    playPrevious,
    toggleShuffle,
    cycleRepeatMode,
    setCurrentTime,
    setDuration,
    handleEnded,
  } = usePlayerStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // When the audio URL changes (e.g. version swap), force the element to
  // drop the current playback and reload the new source. Some browsers will
  // happily keep streaming the previous buffer if you only change the `src`
  // attribute — calling `load()` makes the swap deterministic.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.load();
  }, [currentTrack?.audioUrl]);

  // Apply play/pause based on store state.
  // AbortError is suppressed: it's raised when a play() call is interrupted by
  // a new `src` load (e.g. switching versions). The onCanPlay handler below
  // resumes playback automatically once the new source is ready.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !currentTrack) return;
    if (isPlaying) {
      void el.play().catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        console.error('Playback failed', e);
      });
    } else {
      el.pause();
    }
  }, [isPlaying, currentTrack]);

  // Apply volume / mute.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const safeVolume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.8;
    el.volume = safeVolume;
    el.muted = isMuted;
  }, [volume, isMuted]);

  // Keyboard shortcuts: space / arrows / m.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (!currentTrack) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        const el = audioRef.current;
        if (el) el.currentTime = Math.min(el.currentTime + 5, el.duration || el.currentTime + 5);
      } else if (e.code === 'ArrowLeft') {
        const el = audioRef.current;
        if (el) el.currentTime = Math.max(el.currentTime - 5, 0);
      } else if (e.key.toLowerCase() === 'm') {
        toggleMute();
      } else if (e.key.toLowerCase() === 'n') {
        playNext();
      } else if (e.key.toLowerCase() === 'p') {
        playPrevious();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentTrack, togglePlay, toggleMute, playNext, playPrevious]);

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const volumePercent = isMuted ? 0 : Math.round(volume * 100);

  const handleSeek = (val: number | readonly number[]) => {
    const v = parseSliderValue(val);
    if (v == null) return;
    const el = audioRef.current;
    if (!el || !duration) return;
    const newTime = (v / 100) * duration;
    el.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolume = (val: number | readonly number[]) => {
    const v = parseSliderValue(val);
    if (v == null) return;
    setVolume(v / 100);
  };

  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;
  const repeatActive = repeatMode !== 'off';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-zinc-200 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
      <audio
        id={GLOBAL_AUDIO_ID}
        ref={audioRef}
        src={currentTrack.audioUrl}
        onEnded={handleEnded}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDuration(d);
        }}
        onCanPlay={(e) => {
          // After the audio src changes (e.g. version swap), the browser
          // aborts any in-flight play() and starts a fresh load. Once the new
          // file is ready, kick playback back off if the user hadn't paused.
          const el = e.currentTarget;
          if (isPlaying && el.paused) {
            void el.play().catch((err: unknown) => {
              if (err instanceof DOMException && err.name === 'AbortError') return;
              console.error('Playback resume failed', err);
            });
          }
        }}
        preload="metadata"
      />

      {/* Seek bar */}
      <div className="px-6 pt-2 pb-1 flex items-center gap-3 max-w-5xl mx-auto">
        <span className="text-[10px] font-mono text-zinc-500 w-10 text-right tabular-nums">
          {formatTime(currentTime)}
        </span>
        <Slider
          aria-label="Posición de la pista"
          value={[progressPercent]}
          max={100}
          step={0.1}
          onValueChange={handleSeek}
          className="flex-1"
        />
        <span className="text-[10px] font-mono text-zinc-500 w-10 tabular-nums">
          {formatTime(duration)}
        </span>
      </div>

      <div className="px-4 pb-4 pt-1">
        <div className="container mx-auto flex items-center justify-between max-w-5xl gap-4">
          {/* Track Info */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {currentTrack.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentTrack.coverUrl}
                alt={`Carátula de ${currentTrack.title}`}
                className="w-12 h-12 rounded object-cover shrink-0"
              />
            ) : (
              <div className="w-12 h-12 bg-zinc-100 rounded flex items-center justify-center shrink-0">
                <span className="text-xs text-zinc-400 font-mono">wav</span>
              </div>
            )}
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-zinc-950 truncate">{currentTrack.title}</h4>
              <p className="text-xs text-zinc-500 truncate">{currentTrack.author}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center flex-1 justify-center gap-6">
            <button
              onClick={toggleShuffle}
              aria-label="Modo aleatorio"
              aria-pressed={isShuffle}
              className={`hover:scale-110 transition-all ${isShuffle ? 'text-zinc-950' : 'text-zinc-400 hover:text-zinc-600'}`}
              title="Aleatorio"
            >
              <Shuffle size={18} />
            </button>

            <button
              onClick={playPrevious}
              aria-label="Pista anterior"
              className="text-zinc-600 hover:text-zinc-950 hover:scale-110 transition-all"
              title="Pista Anterior"
            >
              <SkipBack size={20} />
            </button>

            <button
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
              className="w-12 h-12 rounded-full bg-zinc-950 text-white flex items-center justify-center hover:bg-zinc-800 hover:scale-105 active:scale-95 transition-all shadow-md"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="translate-x-[2px]" />}
            </button>

            <button
              onClick={playNext}
              aria-label="Pista siguiente"
              className="text-zinc-600 hover:text-zinc-950 hover:scale-110 transition-all"
              title="Pista Siguiente"
            >
              <SkipForward size={20} />
            </button>

            <button
              onClick={cycleRepeatMode}
              aria-label={`Modo repetición: ${repeatMode}`}
              aria-pressed={repeatActive}
              className={`hover:scale-110 transition-all ${repeatActive ? 'text-zinc-950' : 'text-zinc-400 hover:text-zinc-600'}`}
              title={
                repeatMode === 'off'
                  ? 'Repetir: desactivado'
                  : repeatMode === 'all'
                    ? 'Repetir: todas'
                    : 'Repetir: una'
              }
            >
              <RepeatIcon size={18} />
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center justify-end gap-3 flex-1">
            <button
              onClick={toggleMute}
              aria-label={isMuted || volume === 0 ? 'Activar sonido' : 'Silenciar'}
              className="text-zinc-600 hover:text-zinc-950 transition-colors"
            >
              {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <Slider
              aria-label="Volumen"
              value={[volumePercent]}
              max={100}
              step={1}
              onValueChange={handleVolume}
              className="w-24"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
