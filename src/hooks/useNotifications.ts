'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-client'
import type { NotificationEntry } from '@/types/notifications'

interface FetchResponse {
  notifications: NotificationEntry[]
  unreadCount: number
}

interface RealtimeNotificationRow {
  id: string
  recipientId: string
}

export interface UseNotifications {
  notifications: NotificationEntry[]
  unreadCount: number
  loading: boolean
  refresh: () => Promise<void>
  markRead: (ids: string[]) => Promise<void>
  markAllRead: () => Promise<void>
}

/**
 * Per-user notifications hook. Loads the latest page from `/api/notifications`
 * and subscribes to inserts on the Notification table via Supabase Realtime.
 * The subscription is filtered by `recipientId` so a viewer only sees their
 * own inserts even though RLS is open (see migration
 * `20260528150100_notifications_realtime`).
 *
 * On every insert we just re-fetch the list rather than hydrating a single
 * row in place. The list is small (20 items), the cost is negligible, and it
 * keeps actor/track joins consistent without a second query path.
 */
export function useNotifications(viewerId: string | null | undefined): UseNotifications {
  const [notifications, setNotifications] = useState<NotificationEntry[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  // We grab the latest fetch ref so out-of-order responses don't overwrite a
  // fresher snapshot — e.g. realtime fires twice quickly, the second response
  // could otherwise land before the first.
  const fetchSeqRef = useRef(0)

  const refresh = useCallback(async () => {
    const seq = ++fetchSeqRef.current
    if (!viewerId) {
      // The setState calls here are intentional on logout — emptying the
      // bell — and happen outside an effect body so the React 19 effect
      // lint rule is satisfied.
      setNotifications([])
      setUnreadCount(0)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as FetchResponse
      if (seq !== fetchSeqRef.current) return
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch (err) {
      console.error('[notifications] refresh failed:', err)
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false)
    }
  }, [viewerId])

  // Initial load + reload whenever the viewer changes (login / logout).
  // `refresh` calls setLoading(true) synchronously, which trips React 19's
  // `set-state-in-effect` lint rule. This is the canonical "fetch on mount"
  // pattern; the rule is meant for derived state, not for syncing with an
  // external system (the API), which is exactly what an effect is for.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  // Realtime: subscribe to inserts addressed to this viewer.
  useEffect(() => {
    if (!viewerId) return
    const channel = supabaseBrowser
      .channel(`notifications-${viewerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Notification',
          filter: `recipientId=eq.${viewerId}`,
        },
        (payload) => {
          const row = payload.new as RealtimeNotificationRow
          if (row.recipientId !== viewerId) return
          void refresh()
        },
      )
      .subscribe()

    return () => {
      void supabaseBrowser.removeChannel(channel)
    }
  }, [viewerId, refresh])

  const markRead = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return
      // Optimistic update — drop the unread highlight immediately.
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
      )
      setUnreadCount((prev) => Math.max(0, prev - ids.length))
      try {
        await fetch('/api/notifications/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        })
      } catch (err) {
        console.error('[notifications] markRead failed:', err)
        // Roll back to the source of truth on error.
        void refresh()
      }
    },
    [refresh],
  )

  const markAllRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
    )
    setUnreadCount(0)
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
    } catch (err) {
      console.error('[notifications] markAllRead failed:', err)
      void refresh()
    }
  }, [refresh])

  return { notifications, unreadCount, loading, refresh, markRead, markAllRead }
}
