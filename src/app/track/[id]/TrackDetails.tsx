'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Play, Pause, ArrowLeft, Trash2, ThumbsUp, MessageCircle, CornerDownRight, Plus, GitBranch } from 'lucide-react';
import { useSession } from 'next-auth/react';
import type { UserLevel } from '@prisma/client';

import { usePlayerStore } from '@/store/usePlayerStore';
import { Card } from '@/components/ui/card';
import { RankBadge } from '@/components/ui/RankBadge';
import { AudioAnalysisPanel } from '@/components/audio/AudioAnalysisPanel';
import { useTrackRealtimeComments } from '@/hooks/useTrackRealtimeComments';
import type { AnalysisIssue, AnalysisResult } from '@/lib/audio-analysis-types';
import type { CommentEntry, TrackData, TrackVersionSummary } from '@/types';

const GLOBAL_AUDIO_ID = 'global-audio-player';

const formatClock = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

interface Props {
  track: TrackData;
  initialComments: CommentEntry[];
  isAuthenticated: boolean;
  isTrackOwner: boolean;
  deletableCommentIds: string[];
  versions: TrackVersionSummary[];
  selectedVersionId: string;
  selectedVersionNumber: number;
  /** Server-computed analysis for the selected version (null when missing). */
  analysisResult: AnalysisResult | null;
}

interface ServerComment {
  id: string;
  content: string;
  timestamp: number;
  parentId?: string | null;
  createdAt: string;
  author: { id: string; name: string | null; email: string | null };
}

export function TrackDetails({
  track,
  initialComments,
  isAuthenticated,
  isTrackOwner,
  deletableCommentIds,
  versions,
  selectedVersionId,
  selectedVersionNumber,
  analysisResult,
}: Props) {
  const latestVersionNumber = versions[0]?.versionNumber ?? selectedVersionNumber;
  const isLatest = selectedVersionNumber === latestVersionNumber;
  const hasMultipleVersions = versions.length > 1;
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const viewerLabel =
    session?.user?.name ?? session?.user?.email?.split('@')[0] ?? 'Yo';
  const viewerLevel: UserLevel | undefined = session?.user?.level;
  const viewerId = session?.user?.id ?? '';

  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);

  const playTrack = usePlayerStore((s) => s.playTrack);
  const replaceCurrentTrack = usePlayerStore((s) => s.replaceCurrentTrack);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  const duration = track.duration ?? 0;

  const [comments, setComments] = useState<CommentEntry[]>(initialComments);
  const [deletable, setDeletable] = useState<Set<string>>(new Set(deletableCommentIds));
  const [draftTimestamp, setDraftTimestamp] = useState<number | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingVote, setPendingVote] = useState<string | null>(null);

  const [manualComment, setManualComment] = useState('');
  const [manualMinutes, setManualMinutes] = useState('');
  const [manualSeconds, setManualSeconds] = useState('');

  const [replyDraftFor, setReplyDraftFor] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const [activeAnalysisIssueId, setActiveAnalysisIssueId] = useState<string | null>(null);

  // IDs of comments inserted by OTHER users via realtime. They flash briefly
  // so the user notices the live update.
  const [recentlyAddedIds, setRecentlyAddedIds] = useState<Set<string>>(new Set());

  // Issues from server analysis split into local (drawn as wave bands) vs
  // global (rendered as cards in the panel only). The panel uses both.
  const localIssues = (analysisResult?.issues ?? []).filter((i) => i.scope === 'local');

  // ── Realtime: live comments + votes from other users ────────────────────
  const handleRemoteCommentAdded = useCallback(
    (entry: CommentEntry, parentId: string | null) => {
      setComments((prev) => {
        if (parentId === null) {
          // Top-level: insert in timestamp order. Defensive de-dup by id.
          if (prev.some((c) => c.id === entry.id)) return prev;
          return [...prev, { ...entry, replies: [] }].sort(
            (a, b) => a.timestamp - b.timestamp,
          );
        }
        // Reply: append under its parent.
        return prev.map((c) => {
          if (c.id !== parentId) return c;
          const replies = c.replies ?? [];
          if (replies.some((r) => r.id === entry.id)) return c;
          return { ...c, replies: [...replies, entry] };
        });
      });
      setRecentlyAddedIds((prev) => {
        const next = new Set(prev);
        next.add(entry.id);
        return next;
      });
      // Clear the highlight after 2.5s.
      setTimeout(() => {
        setRecentlyAddedIds((prev) => {
          if (!prev.has(entry.id)) return prev;
          const next = new Set(prev);
          next.delete(entry.id);
          return next;
        });
      }, 2500);
    },
    [],
  );

  const handleRemoteCommentDeleted = useCallback((id: string) => {
    setComments((prev) =>
      prev
        .filter((c) => c.id !== id)
        .map((c) =>
          c.replies && c.replies.length > 0
            ? { ...c, replies: c.replies.filter((r) => r.id !== id) }
            : c,
        ),
    );
  }, []);

  const handleRemoteVoteAdded = useCallback((commentId: string) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) return { ...c, votes: c.votes + 1 };
        if (c.replies && c.replies.length > 0) {
          return {
            ...c,
            replies: c.replies.map((r) =>
              r.id === commentId ? { ...r, votes: r.votes + 1 } : r,
            ),
          };
        }
        return c;
      }),
    );
  }, []);

  useTrackRealtimeComments({
    trackId: track.id,
    versionId: selectedVersionId,
    viewerId: session?.user?.id ?? null,
    onCommentAdded: handleRemoteCommentAdded,
    onCommentDeleted: handleRemoteCommentDeleted,
    onVoteAdded: handleRemoteVoteAdded,
  });

  /** Open the comment draft pre-filled with the suggestion of an analysis issue. */
  const startCommentFromIssue = (issue: AnalysisIssue) => {
    if (!isAuthenticated) {
      router.push(`/signin?callbackUrl=/track/${track.id}`);
      return;
    }
    // Track-wide issues set `commentAt` to a representative moment; local
    // issues fall back to `start`.
    const target = issue.commentAt ?? issue.start;
    const clampedStart = Math.max(0, Math.min(target, duration || target));
    setDraftTimestamp(clampedStart);
    setNewComment(issue.suggestion);
    setActiveAnalysisIssueId(issue.id);
    if (isPlaying && isCurrentTrack) pause();
    // Also seek the global audio so the listener can hear the issue immediately.
    const audioEl = document.getElementById(GLOBAL_AUDIO_ID) as HTMLAudioElement | null;
    if (audioEl && isCurrentTrack) {
      audioEl.currentTime = clampedStart;
    }
  };

  const isCurrentTrack = currentTrack?.id === track.id;

  const handleWaveformClick = (timestamp: number) => {
    setDraftTimestamp(Math.max(0, Math.min(timestamp, duration)));
    setActiveAnalysisIssueId(null);
    if (isPlaying && isCurrentTrack) pause();
  };

  // Keep the global player in sync when the SERVER hands us a different
  // version (deep link `/track/X?v=1` while V2 was already playing). We read
  // the store imperatively here because depending on `currentTrack` would
  // create a feedback loop with our own dropdown update: replaceCurrentTrack
  // mutates the store BEFORE the server-side props catch up, and a
  // currentTrack-bound effect would then immediately revert it.
  useEffect(() => {
    const current = usePlayerStore.getState().currentTrack;
    if (current?.id === track.id && current.audioUrl !== track.audioUrl) {
      replaceCurrentTrack(track);
    }
  }, [track, replaceCurrentTrack]);

  const selectedVersion = versions.find((v) => v.id === selectedVersionId);
  const versionPeaks = selectedVersion?.peaks ?? [];
  const hasPeaks = versionPeaks.length > 0;

  // SoundCloud-style: WaveSurfer renders straight from server-computed peaks
  // + duration. No audio fetch happens here — the global <audio> handles
  // playback, and this canvas is purely a visual cursor + click target.
  useEffect(() => {
    if (!waveformRef.current) return;

    // Fall back to a flat line if peaks aren't available yet (legacy tracks
    // before the backfill). Still allows clicks for commenting.
    const peaksForRender: number[][] =
      hasPeaks ? [versionPeaks] : [new Array(1800).fill(0)];

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#e4e4e7',
      progressColor: '#09090b',
      cursorColor: '#09090b',
      barWidth: 3,
      barRadius: 3,
      height: 120,
      peaks: peaksForRender,
      duration: duration > 0 ? duration : undefined,
      interact: true,
    });

    wavesurfer.current = ws;

    ws.on('interaction', (newTime) => {
      if (!Number.isFinite(newTime)) return;
      handleWaveformClick(newTime);
      const audioEl = document.getElementById(GLOBAL_AUDIO_ID) as HTMLAudioElement | null;
      if (audioEl && usePlayerStore.getState().currentTrack?.id === track.id) {
        audioEl.currentTime = newTime;
      }
    });

    return () => {
      ws.destroy();
      wavesurfer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersionId, hasPeaks, duration]);

  // Drive the WaveSurfer cursor from the global <audio>. Since no media is
  // loaded into WaveSurfer (it's pure peaks + duration), we just mirror the
  // audio element's currentTime — no ws.play()/pause() needed.
  useEffect(() => {
    if (!isCurrentTrack) return;
    const audioEl = document.getElementById(GLOBAL_AUDIO_ID) as HTMLAudioElement | null;
    const ws = wavesurfer.current;
    if (!audioEl || !ws) return;

    const sync = () => {
      if (Number.isFinite(audioEl.currentTime)) ws.setTime(audioEl.currentTime);
    };

    audioEl.addEventListener('timeupdate', sync);
    audioEl.addEventListener('seeked', sync);
    sync();

    return () => {
      audioEl.removeEventListener('timeupdate', sync);
      audioEl.removeEventListener('seeked', sync);
    };
  }, [isCurrentTrack, selectedVersionId]);

  const buildOptimisticEntry = (c: ServerComment): CommentEntry => ({
    id: c.id,
    content: c.content,
    timestamp: c.timestamp,
    author: c.author.name ?? c.author.email?.split('@')[0] ?? viewerLabel,
    authorId: c.author.id,
    authorLevel: viewerLevel ?? 'IRON',
    createdAt: new Date(c.createdAt).getTime(),
    votes: 0,
    votedByViewer: false,
  });

  const postNewComment = async (
    payload: { content: string; timestamp?: number; parentId?: string; versionId?: string },
  ) => {
    const res = await fetch(`/api/tracks/${track.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? 'No se pudo guardar el comentario.');
    }
    return (await res.json()) as { comment: ServerComment };
  };

  const submitComment = async () => {
    if (!isAuthenticated) {
      router.push(`/signin?callbackUrl=/track/${track.id}`);
      return;
    }
    if (!newComment.trim() || draftTimestamp === null) return;
    if (duration > 0 && draftTimestamp > duration) return;

    setSubmitting(true);
    setError(null);
    try {
      const { comment } = await postNewComment({
        content: newComment.trim(),
        timestamp: draftTimestamp,
        versionId: selectedVersionId,
      });
      const entry: CommentEntry = { ...buildOptimisticEntry(comment), replies: [] };
      setComments((prev) => [...prev, entry].sort((a, b) => a.timestamp - b.timestamp));
      setDeletable((prev) => new Set(prev).add(entry.id));
      setDraftTimestamp(null);
      setNewComment('');
      setActiveAnalysisIssueId(null);
      void updateSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelDraft = () => {
    setDraftTimestamp(null);
    setNewComment('');
    setActiveAnalysisIssueId(null);
  };

  const mins = parseInt(manualMinutes, 10) || 0;
  const secs = parseInt(manualSeconds, 10) || 0;
  const manualTimestamp = mins * 60 + secs;
  const isInvalidSeconds = secs >= 60;
  const isOutOfRange = duration > 0 && manualTimestamp > duration;
  const isInvalidTime = isInvalidSeconds || isOutOfRange;
  const manualError = isInvalidSeconds
    ? 'Los segundos deben ser menores que 60.'
    : isOutOfRange
      ? `La duración máxima es ${formatClock(duration)}.`
      : null;

  const submitManualComment = async () => {
    if (!isAuthenticated) {
      router.push(`/signin?callbackUrl=/track/${track.id}`);
      return;
    }
    if (!manualComment.trim() || isInvalidTime) return;

    setSubmitting(true);
    setError(null);
    try {
      const { comment } = await postNewComment({
        content: manualComment.trim(),
        timestamp: manualTimestamp,
        versionId: selectedVersionId,
      });
      const entry: CommentEntry = { ...buildOptimisticEntry(comment), replies: [] };
      setComments((prev) => [...prev, entry].sort((a, b) => a.timestamp - b.timestamp));
      setDeletable((prev) => new Set(prev).add(entry.id));
      setManualComment('');
      setManualMinutes('');
      setManualSeconds('');
      void updateSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitReply = async (parentId: string) => {
    if (!isAuthenticated) {
      router.push(`/signin?callbackUrl=/track/${track.id}`);
      return;
    }
    if (!replyContent.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const { comment } = await postNewComment({
        content: replyContent.trim(),
        parentId,
      });
      const reply = buildOptimisticEntry(comment);
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId
            ? { ...c, replies: [...(c.replies ?? []), reply] }
            : c,
        ),
      );
      setDeletable((prev) => new Set(prev).add(reply.id));
      setReplyDraftFor(null);
      setReplyContent('');
      void updateSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido.');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (id: string) => {
    if (!confirm('¿Eliminar este comentario?')) return;
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('No se pudo eliminar el comentario.');
      return;
    }
    // Remove top-level OR nested reply.
    setComments((prev) =>
      prev
        .filter((c) => c.id !== id)
        .map((c) =>
          c.replies && c.replies.length > 0
            ? { ...c, replies: c.replies.filter((r) => r.id !== id) }
            : c,
        ),
    );
  };

  const markUseful = async (id: string) => {
    if (pendingVote) return;
    setPendingVote(id);
    setError(null);

    const res = await fetch(`/api/comments/${id}/vote`, { method: 'POST' });

    setPendingVote(null);

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? 'No se pudo marcar como útil.');
      return;
    }

    const { count } = (await res.json()) as { count: number };
    const apply = (c: CommentEntry): CommentEntry =>
      c.id === id ? { ...c, votes: count, votedByViewer: true } : c;
    setComments((prev) =>
      prev.map((c) => ({
        ...apply(c),
        replies: c.replies?.map(apply),
      })),
    );
  };

  const togglePlayback = () => {
    if (!isCurrentTrack) {
      playTrack(track, [track]);
      return;
    }
    if (isPlaying) pause();
    else play();
  };

  // Render helper for a single comment (used for both tops and replies).
  const renderComment = (c: CommentEntry, isReply: boolean) => {
    const canMarkUseful = isTrackOwner && !c.votedByViewer && c.authorId !== viewerId;
    const isFreshFromRealtime = recentlyAddedIds.has(c.id);
    return (
      <div
        key={c.id}
        className={`p-4 transition-colors group/comment ${
          isReply
            ? 'bg-white border-l-2 border-zinc-100'
            : 'border-l-2 border-zinc-200 hover:border-zinc-950 bg-zinc-50/50'
        } ${isFreshFromRealtime ? 'ring-2 ring-emerald-400/60 animate-in fade-in slide-in-from-left-4 bg-emerald-50/40' : ''}`}
      >
        <div className="flex items-center justify-between mb-1 gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {isReply && <CornerDownRight size={12} className="text-zinc-400 shrink-0" aria-hidden />}
            <Link href={`/profile/${c.authorId}`} className="font-semibold text-sm truncate hover:underline">
              {c.author}
            </Link>
            <RankBadge level={c.authorLevel} size="xs" showName={false} />
            {!isReply && (
              <span className="text-zinc-400 text-xs font-mono bg-zinc-100 rounded px-1">
                {formatClock(c.timestamp)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canMarkUseful ? (
              <button
                onClick={() => void markUseful(c.id)}
                disabled={pendingVote === c.id}
                aria-label="Marcar como útil"
                title="Marcar como útil (+25 XP al autor)"
                className="flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-950 px-2 py-1 rounded-full border border-zinc-200 hover:border-zinc-950 transition-all disabled:opacity-50"
              >
                <ThumbsUp size={12} />
                {c.votes > 0 && <span>{c.votes}</span>}
              </button>
            ) : c.votedByViewer || c.votes > 0 ? (
              <span
                className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full"
                title={c.votedByViewer ? 'Marcado como útil por el autor' : 'Útil'}
              >
                <ThumbsUp size={12} className="fill-current" />
                {c.votes > 0 ? c.votes : ''}
                {c.votedByViewer && <span className="ml-1">Útil</span>}
              </span>
            ) : null}
            {(deletable.has(c.id) || isTrackOwner) && (
              <button
                onClick={() => void deleteComment(c.id)}
                aria-label="Eliminar comentario"
                title="Eliminar"
                className="opacity-0 group-hover/comment:opacity-100 text-zinc-400 hover:text-red-600 transition-all p-1"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-zinc-700 whitespace-pre-wrap break-words">{c.content}</p>

        {!isReply && isAuthenticated && (
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => {
                setReplyDraftFor((curr) => (curr === c.id ? null : c.id));
                setReplyContent('');
              }}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-950 flex items-center gap-1 transition-colors"
            >
              <MessageCircle size={12} />
              {replyDraftFor === c.id ? 'Cancelar' : 'Responder'}
            </button>
            {c.replies && c.replies.length > 0 && (
              <span className="text-xs text-zinc-400 font-mono">
                {c.replies.length} {c.replies.length === 1 ? 'respuesta' : 'respuestas'}
              </span>
            )}
          </div>
        )}

        {!isReply && replyDraftFor === c.id && (
          <div className="mt-3 ml-3 p-3 border border-zinc-200 bg-white rounded-md animate-in fade-in slide-in-from-top-2">
            <textarea
              autoFocus
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submitReply(c.id);
                }
                if (e.key === 'Escape') {
                  setReplyDraftFor(null);
                  setReplyContent('');
                }
              }}
              placeholder={`Responder a ${c.author}...`}
              className="w-full text-sm text-zinc-950 bg-transparent border-b border-zinc-200 focus:border-zinc-950 outline-none resize-none pb-2 transition-colors"
              rows={2}
            />
            <div className="flex justify-end mt-2 gap-2">
              <button
                onClick={() => {
                  setReplyDraftFor(null);
                  setReplyContent('');
                }}
                className="text-zinc-500 hover:text-zinc-950 text-xs font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => void submitReply(c.id)}
                disabled={!replyContent.trim() || submitting}
                className="bg-zinc-950 text-white text-xs font-medium px-4 py-1.5 rounded-full hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Enviando...' : 'Responder'}
              </button>
            </div>
          </div>
        )}

        {!isReply && c.replies && c.replies.length > 0 && (
          <div className="mt-3 ml-3 space-y-2">
            {c.replies.map((r) => renderComment(r, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <Link
          href="/my-tracks"
          aria-label="Volver a mis canciones"
          className="w-10 h-10 rounded-full flex items-center justify-center border border-zinc-200 text-zinc-600 hover:bg-zinc-950 hover:text-white transition-all shadow-sm"
          title="Volver"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight mb-1 truncate">{track.title}</h1>
          <p className="text-zinc-500 font-medium flex items-center gap-2 flex-wrap">
            <span>
              Producido por{' '}
              {track.authorId ? (
                <Link href={`/profile/${track.authorId}`} className="text-zinc-950 font-semibold hover:underline">
                  {track.author}
                </Link>
              ) : (
                track.author
              )}
            </span>
            {track.authorLevel && <RankBadge level={track.authorLevel} size="xs" />}
            {track.genre && (
              <span className="inline-block px-2 py-0.5 bg-zinc-100 rounded-md text-xs font-semibold text-zinc-600">
                {track.genre}
              </span>
            )}
          </p>
        </div>
      </div>

      <Card className="p-6 overflow-hidden border-2 border-zinc-100 shadow-sm relative">
        {/* Version selector + new-version action */}
        {(hasMultipleVersions || isTrackOwner) && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-zinc-100">
            <div className="flex items-center gap-2 text-sm">
              <GitBranch size={16} className="text-zinc-500" aria-hidden />
              <span className="text-zinc-500 font-medium">Versión:</span>
              {hasMultipleVersions ? (
                <select
                  value={selectedVersionNumber}
                  onChange={(e) => {
                    const v = Number.parseInt(e.target.value, 10);
                    const target = versions.find((ver) => ver.versionNumber === v);
                    // Update the player BEFORE navigating so the <audio src>
                    // is already on the new version when WaveSurfer rebuilds.
                    if (target && currentTrack?.id === track.id) {
                      replaceCurrentTrack({
                        ...track,
                        audioUrl: target.audioUrl,
                        duration: target.duration,
                      });
                    }
                    router.push(`/track/${track.id}?v=${v}`);
                  }}
                  className="h-8 px-2 rounded-md border border-zinc-200 bg-white text-sm font-mono outline-none focus:border-zinc-950"
                  aria-label="Seleccionar versión"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.versionNumber}>
                      V{v.versionNumber}
                      {v.versionNumber === latestVersionNumber ? ' (actual)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-mono text-sm font-semibold">V{selectedVersionNumber} (actual)</span>
              )}
              {!isLatest && (
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                  Versión antigua
                </span>
              )}
            </div>
            {isTrackOwner && (
              <Link
                href={`/track/${track.id}/version`}
                className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-950 border border-zinc-200 hover:border-zinc-950 px-3 py-1.5 rounded-full transition-colors"
              >
                <Plus size={14} />
                Subir nueva versión
              </Link>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <button
            onClick={togglePlayback}
            className="flex items-center gap-2 bg-zinc-950 text-white px-5 py-2.5 rounded-full font-medium hover:bg-zinc-800 transition-colors shrink-0"
          >
            {isCurrentTrack && isPlaying ? <Pause size={18} /> : <Play size={18} className="translate-x-[1px]" />}
            {isCurrentTrack && isPlaying ? 'Pausar' : 'Reproducir Canción'}
          </button>

          <div className="text-sm text-zinc-600 bg-zinc-50 px-4 py-2.5 rounded-lg border border-zinc-200">
            <span className="font-semibold text-zinc-950">Consejo:</span> Haz clic en la onda para
            dejar un comentario en ese segundo exacto.
          </div>
        </div>

        <div className="relative isolate group">
          {/* min-h reserves space so the layout doesn't collapse before
              WaveSurfer finishes loading the audio (esp. on first paint or
              after a Turbopack HMR). */}
          <div ref={waveformRef} className="w-full min-h-[120px] relative z-10" />

          {/* Analysis markers (Phase 4): translucent bands across the wave
              with the severity color. Lower z-index than comments so comment
              dots always show on top. Click jumps to the comment draft. */}
          {duration > 0 && localIssues.length > 0 && (
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-[15]">
              {localIssues.map((issue) => {
                const leftPercent = Math.max(0, (issue.start / duration) * 100);
                const rawWidth = ((issue.end - issue.start) / duration) * 100;
                const widthPercent = Math.max(0.6, Math.min(rawWidth, 100 - leftPercent));
                const isCritical = issue.severity === 'critical';
                const bandTint = isCritical
                  ? 'bg-red-500/20 border-red-500/60'
                  : 'bg-amber-400/20 border-amber-500/60';
                const dotColor = isCritical ? 'bg-red-500' : 'bg-amber-500';
                return (
                  <button
                    key={issue.id}
                    onClick={() => startCommentFromIssue(issue)}
                    title={issue.title}
                    aria-label={`Comentar: ${issue.title}`}
                    className={`absolute top-0 h-full pointer-events-auto border-l border-r ${bandTint} hover:brightness-110 transition-all cursor-pointer group/issue`}
                    style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                  >
                    {/* Top-edge dot so very short issues (single-sample clips)
                        are still visible. */}
                    <span
                      className={`absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${dotColor} shadow`}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          )}

          <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-20">
            {comments.map((comment) => {
              const leftPercent = duration ? (comment.timestamp / duration) * 100 : 0;
              return (
                <div
                  key={comment.id}
                  className="absolute top-1/2 -translate-y-1/2 pointer-events-auto group/marker"
                  style={{ left: `${leftPercent}%` }}
                >
                  <div className="w-3 h-3 bg-zinc-950 border-2 border-white rounded-full shadow-sm hover:scale-125 transition-transform cursor-pointer" />
                  <div className="opacity-0 group-hover/marker:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white border border-zinc-200 text-zinc-950 text-xs px-3 py-2 rounded shadow-lg whitespace-nowrap min-w-[150px] transition-opacity">
                    <p className="font-semibold text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                      {comment.author}
                    </p>
                    <p>{comment.content}</p>
                  </div>
                </div>
              );
            })}
            {draftTimestamp !== null && duration > 0 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 pointer-events-none z-30"
                style={{ left: `${(draftTimestamp / duration) * 100}%` }}
              >
                <div className="w-4 h-4 bg-white border-4 border-zinc-950 rounded-full shadow-lg relative">
                  <div className="absolute inset-0 bg-white rounded-full animate-[ping_1.5s_ease-in-out_infinite] opacity-75" />
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <AudioAnalysisPanel
        result={analysisResult}
        onCommentIssue={startCommentFromIssue}
        activeIssueId={activeAnalysisIssueId}
      />

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="font-bold text-xl mb-4">Comentarios</h3>
          <div className="space-y-4">
            {!isAuthenticated && (
              <div className="text-sm bg-zinc-50 border border-zinc-200 px-4 py-3 rounded-lg">
                <Link href={`/signin?callbackUrl=/track/${track.id}`} className="font-semibold text-zinc-950 underline">
                  Inicia sesión
                </Link>{' '}
                para dejar feedback en esta pista.
              </div>
            )}

            {error && (
              <div role="alert" className="text-xs text-red-600 font-medium px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                {error}
              </div>
            )}

            {draftTimestamp !== null && (
              <div className="p-4 border-2 border-zinc-950 bg-zinc-50 transition-colors animate-in fade-in slide-in-from-top-4 rounded-sm shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-sm">{viewerLabel}</span>
                    {viewerLevel && <RankBadge level={viewerLevel} size="xs" showName={false} />}
                    <span className="text-zinc-950 text-xs font-mono bg-zinc-200/80 px-2 py-0.5 rounded-full">
                      {formatClock(draftTimestamp)}
                    </span>
                  </div>
                  <button
                    onClick={cancelDraft}
                    className="text-zinc-400 hover:text-zinc-950 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
                <textarea
                  autoFocus
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void submitComment();
                    }
                    if (e.key === 'Escape') cancelDraft();
                  }}
                  placeholder="Escucho un detalle aquí..."
                  className="w-full text-sm text-zinc-950 bg-transparent border-b border-zinc-200 focus:border-zinc-950 outline-none resize-none pb-2 transition-colors"
                  rows={2}
                />
                <div className="flex justify-end mt-3">
                  <button
                    disabled={!newComment.trim() || submitting}
                    onClick={() => void submitComment()}
                    className="bg-zinc-950 text-white text-xs font-medium px-5 py-2 rounded-full hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? 'Guardando...' : 'Guardar Feedback'}
                  </button>
                </div>
              </div>
            )}

            {comments.length === 0 && draftTimestamp === null && (
              <p className="text-sm text-zinc-500 italic">Aún no hay comentarios. Sé el primero.</p>
            )}

            {comments.map((c) => renderComment(c, false))}

            {isAuthenticated && (
              <div className="mt-8 pt-6 border-t border-zinc-200">
                <h4 className="font-semibold text-sm text-zinc-950 mb-3">
                  Añadir feedback sin hacer clic en la onda
                </h4>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-4 flex-col lg:flex-row">
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-zinc-500 font-medium mr-1 uppercase tracking-widest">
                        MIN:SEG
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label="Minutos"
                        placeholder="00"
                        maxLength={2}
                        value={manualMinutes}
                        onChange={(e) => setManualMinutes(e.target.value.replace(/\D/g, ''))}
                        className={`w-10 h-8 rounded border text-center text-sm outline-none transition-colors px-1 font-mono ${
                          isInvalidTime
                            ? 'border-red-500 text-red-600 bg-red-50'
                            : 'border-zinc-200 bg-white focus:border-zinc-950'
                        }`}
                      />
                      <span className="text-zinc-400 font-bold">:</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label="Segundos"
                        placeholder="00"
                        maxLength={2}
                        value={manualSeconds}
                        onChange={(e) => setManualSeconds(e.target.value.replace(/\D/g, ''))}
                        className={`w-10 h-8 rounded border text-center text-sm outline-none transition-colors px-1 font-mono ${
                          isInvalidTime
                            ? 'border-red-500 text-red-600 bg-red-50'
                            : 'border-zinc-200 bg-white focus:border-zinc-950'
                        }`}
                      />
                    </div>
                    <div className="flex-1 w-full flex flex-col sm:flex-row gap-3 lg:items-center">
                      <input
                        type="text"
                        aria-label="Contenido del comentario"
                        placeholder="Escribe tu comentario..."
                        value={manualComment}
                        onChange={(e) => setManualComment(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isInvalidTime && manualComment.trim()) {
                            void submitManualComment();
                          }
                        }}
                        className="flex-1 h-8 bg-transparent border-b border-zinc-200 focus:border-zinc-950 outline-none text-sm transition-colors text-zinc-950 placeholder:text-zinc-400"
                      />
                      <button
                        onClick={() => void submitManualComment()}
                        disabled={!manualComment.trim() || isInvalidTime || submitting}
                        className={`shrink-0 text-white text-xs font-medium px-5 h-8 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                          isInvalidTime ? 'bg-red-500 hover:bg-red-600' : 'bg-zinc-950 hover:bg-zinc-800'
                        }`}
                      >
                        {submitting ? '...' : 'Añadir al registro'}
                      </button>
                    </div>
                  </div>

                  {manualError && (
                    <div
                      role="alert"
                      className="text-xs text-red-600 font-medium px-2 py-1 bg-red-50 border border-red-200 rounded self-start mt-1"
                    >
                      ⚠️ {manualError}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
