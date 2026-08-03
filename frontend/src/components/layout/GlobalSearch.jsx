import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { studentService, teacherService, communicationService } from '../../services/api'
import { useAuth } from '../../hooks'
import { Spinner } from '../common'

const MIN_QUERY_LEN = 2
const DEBOUNCE_MS = 300

export default function GlobalSearch({ open, onClose }) {
  const { isAdmin, isTeacher } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState({ students: [], teachers: [], notices: [] })
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setResults({ students: [], teachers: [], notices: [] })
    const t = setTimeout(() => inputRef.current?.focus(), 10)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < MIN_QUERY_LEN) {
      setResults({ students: [], teachers: [], notices: [] })
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    const timeoutId = setTimeout(async () => {
      try {
        const [noticesRes, studentsRes, teachersRes] = await Promise.all([
          communicationService.notices({ search: q, page_size: 5 }),
          (isAdmin || isTeacher) ? studentService.list({ search: q, page_size: 5 }) : Promise.resolve({ data: [] }),
          isAdmin ? teacherService.list({ search: q, page_size: 5 }) : Promise.resolve({ data: [] }),
        ])
        if (cancelled) return
        setResults({
          notices:  noticesRes.data?.results ?? noticesRes.data ?? [],
          students: studentsRes.data?.results ?? studentsRes.data ?? [],
          teachers: teachersRes.data?.results ?? teachersRes.data ?? [],
        })
      } catch {
        // best-effort search; a failed request just shows no results
        if (!cancelled) setResults({ students: [], teachers: [], notices: [] })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => { cancelled = true; clearTimeout(timeoutId) }
  }, [query, open, isAdmin, isTeacher])

  if (!open) return null

  const goTo = (path) => {
    onClose()
    navigate(path)
  }

  const hasResults = results.students.length || results.teachers.length || results.notices.length
  const q = query.trim()

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-xl rounded-2xl shadow-2xl animate-slide-up overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
            placeholder="Search students, teachers, notices…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
          />
          {loading && <Spinner size="sm" />}
          <kbd
            className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
          >
            Esc
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {q.length < MIN_QUERY_LEN ? (
            <p className="text-sm px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
              Type at least {MIN_QUERY_LEN} characters to search…
            </p>
          ) : !hasResults && !loading ? (
            <p className="text-sm px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
              No matches for &quot;{q}&quot;
            </p>
          ) : (
            <>
              {results.students.length > 0 && (
                <ResultGroup
                  label="Students"
                  items={results.students.map((s) => ({
                    id: s.id,
                    title: s.full_name || s.user_detail?.full_name || 'Student',
                    sub: `Class ${s.class_name}${s.section} · Roll ${s.roll_number}`,
                    path: `/students?q=${encodeURIComponent(s.roll_number || s.full_name || q)}`,
                  }))}
                  onSelect={goTo}
                />
              )}
              {results.teachers.length > 0 && (
                <ResultGroup
                  label="Teachers"
                  items={results.teachers.map((t) => ({
                    id: t.id,
                    title: t.full_name || 'Teacher',
                    sub: t.qualification || t.email || '',
                    path: `/teachers?q=${encodeURIComponent(t.full_name || q)}`,
                  }))}
                  onSelect={goTo}
                />
              )}
              {results.notices.length > 0 && (
                <ResultGroup
                  label="Notices"
                  items={results.notices.map((n) => ({
                    id: n.id,
                    title: n.title,
                    sub: n.message,
                    path: '/calendar',
                  }))}
                  onSelect={goTo}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultGroup({ label, items, onSelect }) {
  return (
    <div className="py-2">
      <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      {items.map((item) => (
        <button
          key={item.id}
          className="w-full text-left px-4 py-2.5 transition-colors"
          style={{ color: 'var(--text-primary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          onClick={() => onSelect(item.path)}
        >
          <p className="text-sm font-medium truncate">{item.title}</p>
          {item.sub && <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{item.sub}</p>}
        </button>
      ))}
    </div>
  )
}
