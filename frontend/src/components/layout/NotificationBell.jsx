import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { communicationService, notificationService } from '../../services/api'
import { useAuth } from '../../hooks'

const SEEN_KEY_PREFIX = 'notif_bell_seen'
const POLL_MS = 60000

function loadSeen(userId) {
  try {
    const raw = localStorage.getItem(`${SEEN_KEY_PREFIX}:${userId}`)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function saveSeen(userId, idSet) {
  try {
    localStorage.setItem(`${SEEN_KEY_PREFIX}:${userId}`, JSON.stringify([...idSet].slice(-200)))
  } catch {
    // best-effort persistence only
  }
}

export default function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [seenIds, setSeenIds] = useState(() => loadSeen(user?.id))
  const panelRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [noticesRes, eventsRes, personalRes] = await Promise.all([
          communicationService.notices({ page_size: 8 }),
          communicationService.events({ page_size: 8 }),
          notificationService.list({ page_size: 8 }).catch(() => null),
        ])
        if (cancelled) return

        const notices = (noticesRes.data?.results ?? noticesRes.data ?? []).map((n) => ({
          id: `notice-${n.id}`,
          kind: 'Notice',
          badge: 'badge-blue',
          title: n.title,
          detail: n.message,
          date: n.created_at || n.updated_at,
          link: '/calendar',
        }))
        const events = (eventsRes.data?.results ?? eventsRes.data ?? []).map((e) => ({
          id: `event-${e.id}`,
          kind: e.event_type ? e.event_type.charAt(0).toUpperCase() + e.event_type.slice(1) : 'Event',
          badge: 'badge-purple',
          title: e.title,
          detail: `${e.start_date} – ${e.end_date}`,
          date: e.created_at || e.start_date,
          link: '/calendar',
        }))
        const personal = (personalRes?.data?.results ?? personalRes?.data ?? []).map((n) => ({
          id: `personal-${n.id}`,
          rawId: n.id,
          personal: true,
          isRead: n.is_read,
          kind: 'Application',
          badge: 'badge-green',
          title: n.title,
          detail: n.message,
          date: n.created_at,
          link: n.link || '/applications',
        }))

        const merged = [...personal, ...notices, ...events]
          .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
          .slice(0, 10)
        setItems(merged)
      } catch {
        // Notifications are best-effort; a failed fetch should never break the header.
      }
    }

    load()
    const intervalId = setInterval(load, POLL_MS)
    return () => { cancelled = true; clearInterval(intervalId) }
  }, [])

  useEffect(() => {
    const onClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const isUnread = (item) => (item.personal ? !item.isRead : !seenIds.has(item.id))
  const unreadCount = items.filter(isUnread).length

  const markAllRead = () => {
    const next = new Set(seenIds)
    items.forEach((i) => next.add(i.id))
    setSeenIds(next)
    saveSeen(user?.id, next)
    setItems((prev) => prev.map((i) => (i.personal ? { ...i, isRead: true } : i)))
    if (items.some((i) => i.personal && !i.isRead)) {
      notificationService.markAllRead().catch(() => {})
    }
  }

  const openItem = (item) => {
    setOpen(false)
    if (item.personal) {
      if (!item.isRead) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isRead: true } : i)))
        notificationService.markRead(item.rawId).catch(() => {})
      }
    } else {
      const next = new Set(seenIds)
      next.add(item.id)
      setSeenIds(next)
      saveSeen(user?.id, next)
    }
    navigate(item.link || '/calendar')
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        className="icon-btn relative"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
          <path d="M10 2a6 6 0 00-6 6v3.09c0 .518-.196 1.017-.548 1.397L2.4 13.664A1 1 0 003.14 15.4h13.72a1 1 0 00.74-1.736l-1.052-1.177A2.1 2.1 0 0116 11.09V8a6 6 0 00-6-6zM8.5 17.5a1.5 1.5 0 003 0h-3z" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2"
            style={{ background: 'var(--danger)', '--tw-ring-color': 'var(--bg-primary)' }}
          />
        )}
      </button>

      {open && (
        <div className="dropdown-panel animate-slide-up">
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <p className="text-sm font-bold" style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text-primary)' }}>
              Notifications
            </p>
            {unreadCount > 0 && (
              <button className="text-xs font-medium" style={{ color: 'var(--accent)' }} onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-sm px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                You&apos;re all caught up.
              </p>
            ) : (
              items.map((item) => {
                const unread = isUnread(item)
                return (
                  <button
                    key={item.id}
                    className="w-full text-left px-4 py-3 transition-colors"
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: unread ? 'var(--bg-hover)' : 'transparent',
                    }}
                    onClick={() => openItem(item)}
                  >
                    <div className="flex items-center gap-2">
                      <span className={item.badge}>{item.kind}</span>
                      {unread && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />}
                    </div>
                    <p className="text-sm font-semibold mt-1 truncate" style={{ color: 'var(--text-primary)' }}>
                      {item.title}
                    </p>
                    {item.detail && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                        {item.detail}
                      </p>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
