/**
 * AuthContext provides:
 *   user, role, isAuthenticated, isLoading
 *   login(email, password) → Promise
 *   logout()
 *
 * On mount, it rehydrates from localStorage and fetches the
 * latest user profile to catch any server-side changes.
 */

import React, { createContext, useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { authService, communicationService } from '../services/api'

export const AuthContext = createContext(null)
const SEEN_EVENT_KEY_PREFIX = 'seen_calendar_event_notifications'
const LAST_CHECK_KEY_PREFIX = 'calendar_event_notification_last_check'

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null)
  const [isLoading, setLoading] = useState(true)

  const getSeenEventIds = (storageKey) => {
    try {
      const raw = localStorage.getItem(storageKey)
      const parsed = raw ? JSON.parse(raw) : []
      return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
    } catch {
      return new Set()
    }
  }

  const saveSeenEventIds = (storageKey, idSet) => {
    // Keep this compact; we only need a rolling history to prevent duplicate popups.
    const list = [...idSet].slice(-300)
    localStorage.setItem(storageKey, JSON.stringify(list))
  }

  const getLastCheckMs = (storageKey) => {
    const raw = localStorage.getItem(storageKey)
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }

  const saveLastCheckMs = (storageKey, timestampMs) => {
    localStorage.setItem(storageKey, String(timestampMs))
  }

  // Re-hydrate session from localStorage on first render
  useEffect(() => {
    const stored = localStorage.getItem('user')
    const token  = localStorage.getItem('access_token')
    if (stored && token) {
      setUser(JSON.parse(stored))
      // Silently refresh user data in the background
      authService.me()
        .then(({ data }) => {
          setUser(data)
          localStorage.setItem('user', JSON.stringify(data))
        })
        .catch(() => {
          // Token invalid/expired — force logout
          clearSession()
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user || !['teacher', 'staff', 'student'].includes(user.role)) return undefined

    let disposed = false
    const seenKey = `${SEEN_EVENT_KEY_PREFIX}:${user.id}:${user.school || 'noschool'}`
    const lastCheckKey = `${LAST_CHECK_KEY_PREFIX}:${user.id}:${user.school || 'noschool'}`
    let seenIds = getSeenEventIds(seenKey)

    // On first run, include very recent events so users still get a popup right after login.
    let lastCheckMs = getLastCheckMs(lastCheckKey)
    if (!lastCheckMs) {
      lastCheckMs = Date.now() - 5 * 60 * 1000
    }

    const pollEvents = async () => {
      try {
        const { data } = await communicationService.events({ page_size: 100 })
        const events = data?.results ?? data ?? []
        if (!Array.isArray(events)) return

        const pollStartedAt = Date.now()

        const ordered = [...events].sort(
          (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
        )

        for (const evt of ordered) {
          const eventId = String(evt.id)
          const createdAtMs = Date.parse(evt.created_at || '')
          if (!eventId || seenIds.has(eventId) || Number.isNaN(createdAtMs)) continue

          if (createdAtMs <= lastCheckMs) continue

          seenIds.add(eventId)
          if (disposed) continue

          toast(`New ${evt.event_type?.toUpperCase?.() || 'EVENT'}: ${evt.title}`, {
            duration: 30000,
          })
        }

        saveSeenEventIds(seenKey, seenIds)
        lastCheckMs = pollStartedAt
        saveLastCheckMs(lastCheckKey, lastCheckMs)
      } catch {
        // Silent fail: notifications should never disrupt auth/session behavior.
      }
    }

    pollEvents()
    const intervalId = setInterval(pollEvents, 10000)

    return () => {
      disposed = true
      clearInterval(intervalId)
    }
  }, [user?.id, user?.role])

  const clearSession = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    setUser(null)
  }

  const login = useCallback(async (email, password) => {
    // 1. Get tokens
    const { data: tokens } = await authService.login(email, password)
    localStorage.setItem('access_token',  tokens.access)
    localStorage.setItem('refresh_token', tokens.refresh)

    // 2. Fetch user profile (includes role, school, etc.)
    const { data: profile } = await authService.me()
    localStorage.setItem('user', JSON.stringify(profile))
    setUser(profile)
    return profile
  }, [])

  const refreshUser = useCallback(async () => {
    const { data: profile } = await authService.me()
    localStorage.setItem('user', JSON.stringify(profile))
    setUser(profile)
    return profile
  }, [])

  const logout = useCallback(() => {
    clearSession()
  }, [])

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    role: user?.role ?? null,
    isAdmin:   user?.role === 'admin',
    isTeacher: user?.role === 'teacher',
    isStaff:   user?.role === 'staff',
    isStudent: user?.role === 'student',
    login,
    refreshUser,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
