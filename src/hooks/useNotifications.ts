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
 * Hook de notificaciones por usuario. Carga la lista desde `/api/notifications`
 * y se suscribe a los INSERT en la tabla `Notification` vía Supabase Realtime,
 * filtrados por `recipientId`. Cada evento dispara un re-fetch en lugar de
 * insertar la fila en memoria, así no hace falta replicar los joins.
 */
export function useNotifications(viewerId: string | null | undefined): UseNotifications {
  const [notifications, setNotifications] = useState<NotificationEntry[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  // Secuencia para descartar respuestas obsoletas si llegan fuera de orden.
  const fetchSeqRef = useRef(0)

  const refresh = useCallback(async () => {
    const seq = ++fetchSeqRef.current
    if (!viewerId) {
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

  // Carga inicial y recarga al cambiar de usuario.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  // Suscripción Realtime a los INSERT dirigidos a este usuario. El sufijo
  // `Date.now()` en el nombre del canal evita colisiones si el efecto se
  // ejecuta dos veces seguidas (Strict Mode en desarrollo).
  useEffect(() => {
    if (!viewerId) return
    const channelName = `notifications-${viewerId}-${Date.now()}`
    const channel = supabaseBrowser
      .channel(channelName)
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
      // Actualización optimista: quita el badge de no leído al instante.
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
        // Revertir al estado del servidor si falla.
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
