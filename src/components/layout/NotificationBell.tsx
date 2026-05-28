'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, MessageCircle, ThumbsUp, CornerDownRight, CheckCheck } from 'lucide-react'
import type { NotificationKind } from '@prisma/client'

import { RankBadge } from '@/components/ui/RankBadge'
import { useNotifications } from '@/hooks/useNotifications'
import type { NotificationEntry } from '@/types/notifications'

interface Props {
  viewerId: string
}

const KIND_COPY: Record<NotificationKind, { icon: typeof Bell; verb: string }> = {
  comment: { icon: MessageCircle, verb: 'comentó tu pista' },
  reply: { icon: CornerDownRight, verb: 'respondió a tu comentario' },
  vote: { icon: ThumbsUp, verb: 'marcó útil tu comentario' },
}

/**
 * Bell + popover in the Navbar. Hidden when not signed in (the Navbar handles
 * that). Badge counts UNREAD only; opening the popover does NOT auto-mark
 * everything as read — that's an explicit action ("Marcar todas") or a
 * per-row click, so the user keeps control of when the badge clears.
 */
export function NotificationBell({ viewerId }: Props) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(viewerId)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click + Escape — minimal popover plumbing without
  // pulling in a UI library.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const badge = unreadCount > 9 ? '9+' : String(unreadCount)

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={
          unreadCount > 0
            ? `Notificaciones (${unreadCount} sin leer)`
            : 'Notificaciones'
        }
        title="Notificaciones"
        className="relative text-zinc-600 hover:text-zinc-950 transition-colors p-1 -m-1"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm tabular-nums"
            aria-hidden
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2"
        >
          <header className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/60">
            <span className="text-sm font-semibold text-zinc-950">Notificaciones</span>
            {unreadCount > 0 && (
              <button
                onClick={() => void markAllRead()}
                className="flex items-center gap-1 text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition-colors"
              >
                <CheckCheck size={12} />
                Marcar todas
              </button>
            )}
          </header>

          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-zinc-500 italic text-center py-8 px-4">
                Aún no tienes notificaciones.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {notifications.map((n) => (
                  <NotificationRow
                    key={n.id}
                    entry={n}
                    onActivate={() => {
                      if (!n.readAt) void markRead([n.id])
                      setOpen(false)
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface RowProps {
  entry: NotificationEntry
  onActivate: () => void
}

function NotificationRow({ entry, onActivate }: RowProps) {
  const copy = KIND_COPY[entry.kind]
  const Icon = copy.icon
  const unread = !entry.readAt

  // Build the target URL. Notifications about a track always link to the
  // track page; we anchor the comment when one is attached so the user lands
  // right where the event happened.
  const href = entry.trackId
    ? entry.versionId
      ? `/track/${entry.trackId}?v=${encodeURIComponent(entry.versionId)}${entry.commentId ? `#comment-${entry.commentId}` : ''}`
      : `/track/${entry.trackId}${entry.commentId ? `#comment-${entry.commentId}` : ''}`
    : '#'

  return (
    <li>
      <Link
        href={href}
        onClick={onActivate}
        className={`block px-4 py-3 transition-colors hover:bg-zinc-50 ${
          unread ? 'bg-blue-50/40' : ''
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 w-7 h-7 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center">
            <Icon size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-zinc-950">
              <span className="font-semibold">{entry.actor.name}</span>{' '}
              <RankBadge level={entry.actor.level} size="xs" showName={false} />{' '}
              <span className="text-zinc-700">{copy.verb}</span>
              {entry.trackTitle && (
                <>
                  {' '}
                  <span className="text-zinc-500">·</span>{' '}
                  <span className="text-zinc-700 font-medium truncate inline-block max-w-[200px] align-bottom">
                    {entry.trackTitle}
                  </span>
                </>
              )}
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">
              {formatRelative(entry.createdAt)}
            </p>
          </div>
          {unread && (
            <span
              className="mt-2 w-2 h-2 rounded-full bg-blue-500 shrink-0"
              aria-label="No leída"
              title="No leída"
            />
          )}
        </div>
      </Link>
    </li>
  )
}

/**
 * Lightweight "hace 5 min" formatter. We avoid `Intl.RelativeTimeFormat`
 * because we want consistent Spanish copy without depending on the browser's
 * locale settings.
 */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Math.max(0, Date.now() - then)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'hace unos segundos'
  const min = Math.floor(sec / 60)
  if (min < 60) return `hace ${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `hace ${hr} h`
  const day = Math.floor(hr / 24)
  if (day < 7) return `hace ${day} d`
  return new Date(then).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}
