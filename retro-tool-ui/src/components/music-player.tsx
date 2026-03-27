/**
 * MusicPlayer — Floating ambient music player for retro/estimate sessions.
 *
 * HOW TO ADD TRACKS:
 * 1. Go to https://mixkit.co/free-music/ or https://freemusicarchive.org
 * 2. Download an mp3 and host it (e.g. in /public/music/) or use a CDN link
 * 3. Add an entry to the TRACKS array below:
 *    { id: 'x1', title: 'My Track', genre: 'lofi', src: '/music/my-track.mp3' }
 *
 * NOTE: External CDN links (e.g. cdn.pixabay.com) block hotlinking.
 *       Host your own files or use a service that allows direct linking.
 *       The player auto-skips any track that fails to load.
 */

import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

// ─── Track Catalogue ─────────────────────────────────────────────────────────
// Add your own tracks here. Host audio files in /public/music/ for reliability.
// Example: src: '/music/lofi-chill.mp3'

type Genre = 'ambient' | 'lofi' | 'jazz' | 'nature' | 'Trap'

interface Track {
  id: string
  title: string
  genre: Genre
  src: string
}

const TRACKS: Track[] = [
  // ── Add your tracks below ────────────────────────────────────────────────
  // Place .mp3 files in retro-tool-ui/public/music/ then add entries here.
  {
    id: 'a1',
    title: 'Rnb Focus',
    genre: 'ambient',
    src: '/music/rnbbass-ambient.mp3',
  },
  {
    id: 'j1',
    title: 'Smooth Jazz',
    genre: 'jazz',
    src: '/music/smooth-jazz.mp3',
  },
  {
    id: 'j2',
    title: 'Notaigenerated',
    genre: 'jazz',
    src: '/music/notaigenerated-jazz.mp3',
  },
  {
    id: 'j2',
    title: 'Smooth-Jazz',
    genre: 'jazz',
    src: '/music/smooth-jazz.mp3',
  },
  {
    id: 't1',
    title: 'Panda Trap',
    genre: 'Trap',
    src: '/music/panda-trap.mp3',
  },
  {
    id: 't2',
    title: 'Seductive Trap',
    genre: 'Trap',
    src: '/music/seductive-trap.mp3',
  },
  {
    id: 't3',
    title: 'Energetic Trap',
    genre: 'Trap',
    src: '/music/kontraa-trap.mp3',
  },
  {
    id: 't4',
    title: 'Toxic-Love Trap',
    genre: 'Trap',
    src: '/music/toxic-love-trap.mp3',
  },
  // ─────────────────────────────────────────────────────────────────────────
]

const GENRES: { id: Genre; label: string; emoji: string }[] = [
  { id: 'ambient', label: 'Ambient', emoji: '🌌' },
  { id: 'jazz', label: 'Jazz', emoji: '🎷' },
  { id: 'Trap', label: 'Trap', emoji: '🎶' },
]

const LS_KEY = 'music-player-state'

interface SavedState {
  volume: number
  genre: Genre
  trackId: string
  muted: boolean
}

function loadState(): Partial<SavedState> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as SavedState) : {}
  } catch {
    return {}
  }
}

function saveState(state: SavedState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MusicPlayer() {
  const saved = loadState()

  const [expanded, setExpanded] = useState(false)
  const [genre, setGenre] = useState<Genre>(saved.genre ?? 'lofi')
  const [volume, setVolume] = useState(saved.volume ?? 0.5)
  const [muted, setMuted] = useState(saved.muted ?? false)
  const [playing, setPlaying] = useState(false)
  const [trackIndex, setTrackIndex] = useState(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const genreTracks = TRACKS.filter((t) => t.genre === genre)
  const currentTrack: Track | null =
    genreTracks.length > 0 ? genreTracks[trackIndex % genreTracks.length] : null
  const hasTracks = genreTracks.length > 0

  // Restore saved track index when genre changes
  useEffect(() => {
    const savedId = saved.trackId
    const idx = genreTracks.findIndex((t) => t.id === savedId)
    setTrackIndex(idx >= 0 ? idx : 0)
  }, [genre])

  // Persist state
  useEffect(() => {
    if (currentTrack) {
      saveState({ volume, genre, trackId: currentTrack.id, muted })
    }
  }, [volume, genre, currentTrack, muted])

  // Audio element lifecycle
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'none'
    audioRef.current = audio

    const onEnded = () => {
      setTrackIndex((i) => (i + 1) % Math.max(genreTracks.length, 1))
    }

    // Auto-skip on load error (403, network issues, etc.)
    const onError = () => {
      console.warn('[MusicPlayer] Failed to load track — skipping.')
      setPlaying(false)
      if (genreTracks.length > 1) {
        setTrackIndex((i) => (i + 1) % genreTracks.length)
      }
    }

    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [])

  // Track source change
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    const wasPlaying = !audio.paused
    audio.src = currentTrack.src
    audio.volume = volume
    audio.muted = muted
    if (wasPlaying || playing) {
      audio.play().catch(() => setPlaying(false))
    }
  }, [currentTrack?.id])

  // Volume / mute sync
  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = volume
    audioRef.current.muted = muted
  }, [volume, muted])

  const togglePlay = () => {
    if (!hasTracks) return
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      if (!audio.src && currentTrack !== null) audio.src = currentTrack.src
      audio.play().catch(() => setPlaying(false))
      setPlaying(true)
    } else {
      audio.pause()
      setPlaying(false)
    }
  }

  const skipNext = () => {
    if (!hasTracks) return
    setTrackIndex((i) => (i + 1) % genreTracks.length)
    setPlaying(true)
  }

  const skipPrev = () => {
    if (!hasTracks) return
    setTrackIndex((i) => (i - 1 + genreTracks.length) % genreTracks.length)
    setPlaying(true)
  }

  const handleGenreChange = (g: Genre) => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.src = ''
    }
    setGenre(g)
    setTrackIndex(0)
    setPlaying(false)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Expanded panel */}
      {expanded && (
        <div className="w-72 rounded-2xl border border-border/60 bg-background/95 shadow-xl backdrop-blur-md overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Focus Music</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setExpanded(false)}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Genre tabs */}
          <div className="flex gap-1 px-3 pb-2">
            {GENRES.map((g) => (
              <button
                key={g.id}
                onClick={() => handleGenreChange(g.id)}
                className={cn(
                  'flex-1 rounded-lg py-1 text-[10px] font-medium transition-colors',
                  genre === g.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
                title={g.label}
              >
                {g.emoji}
              </button>
            ))}
          </div>

          {/* Track info */}
          <div className="px-4 py-2">
            <p className="text-xs text-muted-foreground truncate">
              {GENRES.find((g) => g.id === genre)?.label}
            </p>
            {hasTracks ? (
              <p className="text-sm font-medium truncate">
                {currentTrack?.title}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No tracks — add .mp3 files to TRACKS in music-player.tsx
              </p>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 px-4 pb-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={skipPrev}
              disabled={!hasTracks}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="h-10 w-10 rounded-full shadow-md"
              onClick={togglePlay}
              disabled={!hasTracks}
            >
              {playing ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={skipNext}
              disabled={!hasTracks}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2 px-4 pb-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => setMuted((m) => !m)}
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </Button>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[muted ? 0 : volume]}
              onValueChange={([v]) => {
                setVolume(v)
                if (v > 0) setMuted(false)
              }}
              className="flex-1"
            />
          </div>
        </div>
      )}

      {/* Toggle button */}
      <Button
        size="icon"
        variant={playing ? 'default' : 'outline'}
        className={cn(
          'h-12 w-12 rounded-full shadow-lg transition-all',
          playing && 'ring-2 ring-primary/30',
        )}
        onClick={() => setExpanded((e) => !e)}
        title="Focus Music"
      >
        {playing ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Music className="h-5 w-5" />
        )}
      </Button>
    </div>
  )
}
