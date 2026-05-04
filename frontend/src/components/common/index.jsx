import React from 'react'

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 'md' }) {
  const s = { sm: 'w-4 h-4', md: 'w-7 h-7', lg: 'w-10 h-10' }[size]
  return (
    <div
      className={`${s} rounded-full border-2 animate-spin`}
      style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
    />
  )
}

export function FullPageSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center py-20">
      <Spinner size="lg" />
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon, color = '#6366f1', trend }) {
  return (
    <div className="card-hover animate-slide-up">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            {label}
          </p>
          <p className="text-3xl font-bold mt-2" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
            {value ?? '—'}
          </p>
          {sub && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{sub}</p>
          )}
          {trend !== undefined && (
            <span
              className={`inline-flex items-center gap-1 text-xs mt-1 font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
          style={{ background: `${color}22`, color }}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-full ${width} rounded-2xl shadow-2xl animate-slide-up`}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-base font-bold" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ── DataTable ─────────────────────────────────────────────────────────────────
export function DataTable({ columns, data, loading, emptyMessage = 'No records found' }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-12">
                <div className="flex justify-center"><Spinner /></div>
              </td>
            </tr>
          ) : !data?.length ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr key={row.id ?? i}>
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────
export function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button
        className="btn-ghost px-3 py-1.5 text-xs"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        ← Prev
      </button>
      <span className="text-xs px-3" style={{ color: 'var(--text-secondary)' }}>
        Page {page} of {totalPages}
      </span>
      <button
        className="btn-ghost px-3 py-1.5 text-xs"
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next →
      </button>
    </div>
  )
}

// ── Badge helpers ─────────────────────────────────────────────────────────────
export function RoleBadge({ role }) {
  const map = {
    admin:   'badge-purple',
    teacher: 'badge-blue',
    student: 'badge-green',
  }
  return <span className={map[role] ?? 'badge-gray'}>{role}</span>
}

export function StatusBadge({ status }) {
  const map = {
    present: 'badge-green',
    absent:  'badge-red',
    leave:   'badge-yellow',
    paid:    'badge-green',
    pending: 'badge-yellow',
    partial: 'badge-blue',
    waived:  'badge-gray',
  }
  return <span className={map[status] ?? 'badge-gray'}>{status}</span>
}

// ── FormField wrapper ─────────────────────────────────────────────────────────
export function FormField({ label, error, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="text-xs mt-1 text-red-400">{error}</p>}
    </div>
  )
}

// ── Error Alert ───────────────────────────────────────────────────────────────
export function ErrorAlert({ message }) {
  if (!message) return null
  return (
    <div
      className="rounded-xl px-4 py-3 text-sm text-red-300 mb-4"
      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
    >
      {message}
    </div>
  )
}
