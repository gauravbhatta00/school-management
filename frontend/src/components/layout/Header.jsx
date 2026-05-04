import React from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks'
import { toMediaUrl } from '../../utils/media'

const PAGE_TITLES = {
  '/':          { title: 'Dashboard',       subtitle: 'Overview of your school' },
  '/students':  { title: 'Students',        subtitle: 'Manage student records' },
  '/teachers':  { title: 'Teachers',        subtitle: 'Manage teaching staff' },
  '/attendance':{ title: 'Attendance',      subtitle: 'Track daily attendance' },
  '/exams':     { title: 'Examinations',    subtitle: 'Results & grading' },
  '/fees':      { title: 'Fee Management',  subtitle: 'Payments & collections' },
}

export default function Header() {
  const location = useLocation()
  const { user }  = useAuth()
  const meta      = PAGE_TITLES[location.pathname] ?? { title: 'EduCore', subtitle: '' }

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-8 py-4"
      style={{
        background: 'rgba(11,11,19,0.85)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* ── Page title ── */}
      <div>
        <h1 className="text-xl font-bold" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
          {meta.title}
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{meta.subtitle}</p>
      </div>

      {/* ── Right: date + school badge ── */}
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{dateStr}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {user?.school_name ?? 'EduCore Platform'}
          </p>
        </div>

        {user?.profile_photo ? (
          <img
            src={toMediaUrl(user.profile_photo)}
            alt="Profile"
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
          >
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
        )}
      </div>
    </header>
  )
}
