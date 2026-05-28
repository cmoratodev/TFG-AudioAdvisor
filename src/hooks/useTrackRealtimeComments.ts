'use client'

import { useEffect } from 'react'
import { supabaseBrowser } from '@/lib/supabase-client'
import type { CommentEntry } from '@/types'
import type { UserLevel } from '@prisma/client'

interface ServerCommentDetail {
  id: string
  content: string
  timestamp: number
  versionId: string
  parentId: string | null
  createdAt: string
  author: { id: string; name: string | null; email: string | null; level: UserLevel }
  votes: number
  votedByViewer: boolean
}

interface RealtimeCommentRow {
  id: string
  versionId: string
  authorId: string
  parentId: string | null
}

interface RealtimeVoteRow {
  commentId: string
  voterId: string
}

export interface UseTrackRealtimeCommentsOptions {
  /** Track id used to scope the channel name. */
  trackId: string
  /** Only events targeting this version are surfaced. */
  versionId: string
  /** Used to suppress echo of the viewer's own actions (handled optimistically). */
  viewerId: string | null
  onCommentAdded: (entry: CommentEntry, parentId: string | null) => void
  onCommentDeleted: (id: string) => void
  onVoteAdded: (commentId: string) => void
}

type SupabaseChannel = ReturnType<typeof supabaseBrowser.channel>

/**
 * Live subscription to comments and votes on a given track version. Uses
 * Supabase Realtime over WebSocket. Each event triggers a callback so the
 * caller can update its local state — we don't manage the comment array
 * here, because the parent already maintains it (with optimistic inserts
 * for the viewer's own actions).
 *
 * The subscription is deferred ~500ms after mount so it doesn't race with
 * WaveSurfer's audio fetch + the analyzer's fetch hitting the same Supabase
 * origin. Without the delay some browsers intermittently fail one of the
 * concurrent HTTPS fetches with ERR_FAILED while the WebSocket handshake
 * negotiates.
 */
const REALTIME_SUBSCRIBE_DELAY_MS = 500

export function useTrackRealtimeComments({
  trackId,
  versionId,
  viewerId,
  onCommentAdded,
  onCommentDeleted,
  onVoteAdded,
}: UseTrackRealtimeCommentsOptions) {
  useEffect(() => {
    if (!versionId) return

    let channel: SupabaseChannel | null = null
    let disposed = false

    const setupTimer = setTimeout(() => {
      if (disposed) return
      channel = supabaseBrowser.channel(`track-${trackId}-${versionId}`)

      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'Comment' },
        async (payload) => {
          const row = payload.new as RealtimeCommentRow
          if (row.versionId !== versionId) return
          if (viewerId && row.authorId === viewerId) return

          try {
            const res = await fetch(`/api/comments/${row.id}`)
            if (!res.ok) return
            const data = (await res.json()) as { comment: ServerCommentDetail }
            const c = data.comment

            const entry: CommentEntry = {
              id: c.id,
              content: c.content,
              timestamp: c.timestamp,
              author: c.author.name ?? c.author.email?.split('@')[0] ?? 'Usuario',
              authorId: c.author.id,
              authorLevel: c.author.level,
              createdAt: new Date(c.createdAt).getTime(),
              votes: c.votes,
              votedByViewer: c.votedByViewer,
            }
            onCommentAdded(entry, c.parentId)
          } catch (err) {
            console.error('[Realtime] failed to hydrate inserted comment:', err)
          }
        },
      )

      channel.on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'Comment' },
        (payload) => {
          const row = payload.old as { id?: string }
          if (row?.id) onCommentDeleted(row.id)
        },
      )

      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'Vote' },
        (payload) => {
          const row = payload.new as RealtimeVoteRow
          if (viewerId && row.voterId === viewerId) return
          onVoteAdded(row.commentId)
        },
      )

      channel.subscribe()
    }, REALTIME_SUBSCRIBE_DELAY_MS)

    return () => {
      disposed = true
      clearTimeout(setupTimer)
      if (channel) {
        void supabaseBrowser.removeChannel(channel)
        channel = null
      }
    }
  }, [trackId, versionId, viewerId, onCommentAdded, onCommentDeleted, onVoteAdded])
}
