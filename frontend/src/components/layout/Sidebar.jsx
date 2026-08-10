import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks'
import toast from 'react-hot-toast'
import { toMediaUrl } from '../../utils/media'

const NAV = [
  {
    path: '/',
    exact: true,
    label: 'Dashboard',
    roles: ['admin', 'teacher', 'staff', 'student'],
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm8-3a3 3 0 100 6 3 3 0 000-6z" />
      </svg>
    ),
  },
  {
    path: '/students',
    label: 'Students',
    roles: ['admin', 'teacher', 'staff'],
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
      </svg>
    ),
  },
  {
    path: '/teachers',
    label: 'Teacher/Staff',
    roles: ['admin'],
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    path: '/attendance',
    label: 'Attendance',
    roles: ['admin', 'teacher'],
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    path: '/exams',
    label: 'Examinations',
    roles: ['admin', 'teacher'],
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    path: '/subjects',
    label: 'Subjects',
    roles: ['admin'],
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.669 0-3.218.51-4.5 1.385A7.968 7.968 0 009 4.804z" />
      </svg>
    ),
  },
  {
    path: '/fees',
    label: 'Fee Management',
    roles: ['admin', 'staff'],
    // Financial tasks are handed out on purpose, not to every staff member:
    // Accountant gets full fee access, Librarian is scoped server-side to
    // library fees only. Everyone else (Clerk, Lab Assistant, etc.) never
    // sees this link — see apps.fees.permissions.
    staffDesignations: ['Accountant', 'Librarian'],
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
        <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    path: '/payroll',
    label: 'Staff Payroll',
    roles: ['admin', 'staff'],
    // Only Accountant tracks/updates payroll alongside admin — see
    // apps.payroll.permissions.CanManagePayroll.
    staffDesignations: ['Accountant'],
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M10.75 10.818v2.614A3.13 3.13 0 0011.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 00-1.138-.432zM8.33 8.62c.053.055.115.11.184.164.208.163.487.316.85.436v-2.03a3.05 3.05 0 00-.822.375c-.404.267-.516.542-.516.735 0 .152.078.313.304.52z" />
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5.75a.75.75 0 01.75.75v.316a3.78 3.78 0 011.653.713c.426.286.895.734 1.09 1.286a.75.75 0 01-1.415.502c-.008-.02-.048-.128-.245-.294a2.284 2.284 0 00-.708-.398c-.11-.037-.226-.069-.375-.098v2.09l.628.14c.539.144 1.048.352 1.454.68.44.354.814.876.814 1.532 0 .656-.374 1.178-.814 1.532-.406.328-.915.536-1.454.68l-.628.14v.51a.75.75 0 01-1.5 0v-.398a3.86 3.86 0 01-1.85-.814.75.75 0 111.014-1.106c.14.128.42.294.836.4v-2.15c-.35-.09-.72-.216-1.055-.396-.494-.26-1.02-.68-1.164-1.31a.75.75 0 011.462-.334l.002.006.014.028a1.5 1.5 0 00.365.383 2.6 2.6 0 00.376.222V6.03a.75.75 0 01.75-.78z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    path: '/calendar',
    label: 'Notices & Calendar',
    roles: ['admin', 'teacher', 'staff', 'student'],
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zM18 10H2v6a2 2 0 002 2h12a2 2 0 002-2v-6zm-8 2a1 1 0 000 2h4a1 1 0 100-2h-4z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    path: '/applications',
    label: 'My Applications',
    roles: ['student'],
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4z" />
        <path d="M3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6z" />
        <path d="M14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
      </svg>
    ),
  },
  {
    path: '/teacher-review',
    label: 'Review Applications',
    roles: ['teacher'],
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-11-1a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    path: '/admin-review',
    label: 'Applications',
    roles: ['admin'],
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    path: '/settings',
    label: 'Settings',
    roles: ['admin'],
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
      </svg>
    ),
  },
]

export default function Sidebar({ open = false, onClose = () => {} }) {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()

  const visibleLinks = NAV.filter((n) => {
    if (!n.roles.includes(role)) return false
    if (role === 'staff' && n.staffDesignations && !n.staffDesignations.includes(user?.designation)) return false
    return true
  })

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  return (
    <aside
      className={`fixed left-0 top-0 h-screen w-64 flex flex-col z-40 transition-transform duration-300 ease-out
        lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      style={{
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* ── Brand ── */}
      <div className="px-5 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm glow-sm"
            style={{ background: 'var(--accent)' }}
          >
            E
          </div>
          <div>
            <p className="text-sm font-bold" style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text-primary)' }}>
              EduCore
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>School Management</p>
          </div>
        </div>
        <button className="icon-btn lg:hidden" onClick={onClose} aria-label="Close menu">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* ── User pill ── */}
      <div className="px-4 py-3 mx-3 mt-4 rounded-xl" style={{ background: 'var(--bg-hover)' }}>
        <div className="flex items-center gap-3">
          {user?.profile_photo ? (
            <img
              src={toMediaUrl(user.profile_photo)}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
            >
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs truncate capitalize" style={{ color: 'var(--text-secondary)' }}>
              {role}
            </p>
          </div>
        </div>
      </div>

      {/* ── Nav links ── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-hide">
        <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Menu
        </p>
        {visibleLinks.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            end={link.exact}
            onClick={onClose}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive ? 'text-white' : ''
              }`
            }
            style={({ isActive }) => ({
              background: isActive
                ? 'linear-gradient(135deg, var(--accent), #4f46e5)'
                : 'transparent',
              color: isActive ? '#fff' : 'var(--text-secondary)',
              boxShadow: isActive ? '0 4px 16px var(--accent-glow)' : 'none',
            })}
            onMouseEnter={(e) => {
              if (!e.currentTarget.style.background.includes('gradient')) {
                e.currentTarget.style.background = 'var(--bg-hover)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.classList.contains('active') &&
                  !e.currentTarget.style.background.includes('gradient')) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }
            }}
          >
            {link.icon}
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* ── Logout ── */}
      <div className="px-3 pb-5">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.1)'
            e.currentTarget.style.color = '#ef4444'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  )
}
