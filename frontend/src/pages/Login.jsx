import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks'
import toast from 'react-hot-toast'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showPw,   setShowPw]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const profile = await login(email, password)
      toast.success(`Welcome back, ${profile.first_name}!`)
      navigate('/')
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Invalid credentials. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* ── Left: branding panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden"
        style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
      >
        {/* Background glow */}
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #818cf8, transparent)' }}
        />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-lg glow-sm"
            style={{ background: 'var(--accent)' }}
          >
            E
          </div>
          <span className="text-xl font-bold" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
            EduCore 123
          </span>
        </div>

        {/* Hero text */}
        <div className="relative z-10">
          <h1
            className="text-5xl font-bold leading-tight mb-6"
            style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}
          >
            Manage your school{' '}
            <span className="text-gradient">intelligently</span>
          </h1>
          <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)', maxWidth: 380 }}>
            A unified platform for admins, teachers and students. Attendance,
            exams, fees and more — all in one place.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mt-8">
            {['Multi-tenant', 'Role-based access', 'JWT Secured', 'Real-time stats'].map((f) => (
              <span
                key={f}
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs relative z-10" style={{ color: 'var(--text-muted)' }}>
          © 2024 EduCore. Built with Django + React.
        </p>
      </div>

      {/* ── Right: login form ── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm animate-slide-up">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold"
              style={{ background: 'var(--accent)' }}
            >E</div>
            <span className="font-bold" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>EduCore</span>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
            Sign in
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            Enter your school credentials to continue
          </p>

          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm mb-5"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                className="input"
                type="email"
                placeholder="you@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="label">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium"
                  style={{ color: 'var(--accent)' }}
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in →'
              )}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div
            className="mt-6 rounded-xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Demo credentials
            </p>
            <div className="space-y-1.5 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
              <p>Admin → <span style={{ color: 'var(--text-primary)' }}>admin@greenwood.edu</span></p>
              <p>Teacher → <span style={{ color: 'var(--text-primary)' }}>priya.sharma@greenwood.edu</span></p>
              <p>All passwords: <span style={{ color: 'var(--text-primary)' }}>Admin@123 / Teacher@123</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
