import React from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth, useTheme } from '../../hooks'
import { toMediaUrl } from '../../utils/media'
import NotificationBell from './NotificationBell'

const PAGE_TITLES = {
  '/':          { title: 'Dashboard',       subtitle: 'Overview of your school' },
  '/students':  { title: 'Students',        subtitle: 'Manage student records' },
  '/teachers':  { title: 'Teachers',        subtitle: 'Manage teaching staff' },
  '/attendance':{ title: 'Attendance',      subtitle: 'Track daily attendance' },
  '/exams':     { title: 'Examinations',    subtitle: 'Results & grading' },
  '/fees':      { title: 'Fee Management',  subtitle: 'Payments & collections' },
}

export default function Header({ onMenuClick = () => {}, onSearchClick = () => {} }) {
  const location = useLocation()
  const { user }  = useAuth()
  const { theme, toggleTheme } = useTheme()
  const meta      = PAGE_TITLES[location.pathname] ?? { title: 'EduCore', subtitle: '' }

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-8 py-4 gap-3"
      style={{
        background: 'var(--bg-primary-translucent)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* ── Menu button (mobile) + Page title ── */}
      <div className="flex items-center gap-3 min-w-0">
        <button className="icon-btn -ml-1 lg:hidden flex-shrink-0" onClick={onMenuClick} aria-label="Open menu">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold truncate" style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text-primary)' }}>
            {meta.title}
          </h1>
          <p className="text-xs mt-0.5 hidden sm:block" style={{ color: 'var(--text-muted)' }}>{meta.subtitle}</p>
        </div>
      </div>

      {/* ── Right: search + notifications + theme + date + avatar ── */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <button className="search-trigger" onClick={onSearchClick}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <span>Search</span>
          <kbd className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
            Ctrl K
          </kbd>
        </button>

        <button className="icon-btn sm:hidden" onClick={onSearchClick} aria-label="Search">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
        </button>

        <button
          className="icon-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? (
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-9.9a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 9a1 1 0 100 2h1a1 1 0 100-2h-1zM2 9a1 1 0 100 2h1a1 1 0 100-2H2zm2.05-5.536a1 1 0 011.414 0l.707.707A1 1 0 004.757 5.586l-.707-.707a1 1 0 010-1.415zm.707 10.607a1 1 0 00-1.414 1.415l.707.707a1 1 0 001.414-1.415l-.707-.707zM10 15a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1z" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
        </button>

        <NotificationBell />

        <div className="text-right hidden md:block">
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{dateStr}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {user?.school_name ?? 'EduCore Platform'}
          </p>
        </div>

        {user?.profile_photo ? (
          <img
            src={toMediaUrl(user.profile_photo)}
            alt="Profile"
            className="w-9 h-9 rounded-full object-cover ring-2"
            style={{ '--tw-ring-color': 'var(--border)' }}
          />
        ) : (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
          >
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
        )}
      </div>
    </header>
  )
}
