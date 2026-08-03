import { useContext, useState, useEffect, useCallback } from 'react'
import { AuthContext } from '../context/AuthContext'
import { ThemeContext } from '../context/ThemeContext'

// ── useAuth ───────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// ── useTheme ──────────────────────────────────────────────────────────────────
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

// ── useApi ────────────────────────────────────────────────────────────────────
/**
 * Generic async data-fetching hook.
 *
 * Usage:
 *   const { data, loading, error, execute } = useApi(studentService.list)
 *   useEffect(() => execute({ class_name: '10' }), [])
 *
 * execute() re-runs the service call and updates state.
 * immediate: true  → calls the fn immediately on mount (no args).
 */
export function useApi(apiFn, { immediate = false, initialParams = {} } = {}) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(immediate)
  const [error,   setError]   = useState(null)

  const execute = useCallback(
    async (params) => {
      setLoading(true)
      setError(null)
      try {
        const res = await apiFn(params)
        const payload = res.data?.results ?? res.data   // handle paginated responses
        setData(payload)
        return payload
      } catch (err) {
        const msg =
          err.response?.data?.detail ||
          Object.values(err.response?.data || {}).flat().join(' ') ||
          'Something went wrong'
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [apiFn]
  )

  useEffect(() => {
    if (immediate) execute(initialParams)
  }, []) // eslint-disable-line

  return { data, loading, error, execute, setData }
}

// ── usePagination ─────────────────────────────────────────────────────────────
export function usePagination(apiFn, params = {}) {
  const [data,    setData]    = useState([])
  const [count,   setCount]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(false)
  const PAGE_SIZE = 20

  const fetch = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const res = await apiFn({ ...params, page: p, page_size: PAGE_SIZE })
      setData(res.data?.results ?? res.data)
      setCount(res.data?.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, JSON.stringify(params)]) // eslint-disable-line

  useEffect(() => { fetch(page) }, [page]) // eslint-disable-line

  return {
    data, count, page, setPage, loading,
    totalPages: Math.ceil(count / PAGE_SIZE),
    refresh: () => fetch(page),
  }
}
