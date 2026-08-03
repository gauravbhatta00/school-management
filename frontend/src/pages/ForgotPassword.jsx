import React, { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authService } from '../services/api'

const emptyResetState = {
  newPassword: '',
  confirmPassword: '',
}

export default function ForgotPassword() {
  const navigate = useNavigate()
  const { uid, token } = useParams()
  const isConfirmMode = Boolean(uid && token)

  const [email, setEmail] = useState('')
  const [resetForm, setResetForm] = useState(emptyResetState)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const requestReset = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await authService.requestPasswordReset(email.trim())
      setSent(true)
      toast.success('Password reset instructions sent')
    } catch (err) {
      setError(
        err.response?.data?.email?.[0] ||
        'We could not send the reset email. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const confirmReset = async (event) => {
    event.preventDefault()
    setError('')

    if (resetForm.newPassword !== resetForm.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await authService.confirmPasswordReset({
        uid,
        token,
        newPassword: resetForm.newPassword,
      })
      toast.success('Password updated. You can sign in now.')
      navigate('/login', { replace: true })
    } catch (err) {
      const data = err.response?.data || {}
      setError(
        data.new_password?.[0] ||
        data.token?.[0] ||
        data.uid?.[0] ||
        'This reset link is invalid or has expired.'
      )
    } finally {
      setLoading(false)
    }
  }

  const setPasswordField = (field, value) => {
    setResetForm((current) => ({ ...current, [field]: value }))
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex items-center gap-2 mb-8">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold"
            style={{ background: 'var(--accent)' }}
          >
            E
          </div>
          <span className="font-bold" style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text-primary)' }}>
            EduCore
          </span>
        </div>

        <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text-primary)' }}>
          {isConfirmMode ? 'Reset password' : 'Forgot password'}
        </h2>
        <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
          {isConfirmMode
            ? 'Choose a new password for your school account.'
            : 'Students and teachers can request a secure reset link by email.'}
        </p>

        {error && (
          <div
            className="rounded-xl px-4 py-3 text-sm mb-5"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}
          >
            {error}
          </div>
        )}

        {sent && !isConfirmMode ? (
          <div
            className="rounded-xl p-4 text-sm leading-relaxed"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            If a matching student or teacher account exists, a reset link has been sent to that email address.
          </div>
        ) : isConfirmMode ? (
          <form onSubmit={confirmReset} className="space-y-4">
            <div>
              <label className="label">New password</label>
              <input
                className="input"
                type="password"
                value={resetForm.newPassword}
                onChange={(event) => setPasswordField('newPassword', event.target.value)}
                required
                minLength={8}
                autoFocus
              />
            </div>

            <div>
              <label className="label">Confirm password</label>
              <input
                className="input"
                type="password"
                value={resetForm.confirmPassword}
                onChange={(event) => setPasswordField('confirmPassword', event.target.value)}
                required
                minLength={8}
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 mt-2">
              {loading ? 'Updating password...' : 'Update password'}
            </button>
          </form>
        ) : (
          <form onSubmit={requestReset} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                className="input"
                type="email"
                placeholder="you@school.edu"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoFocus
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 mt-2">
              {loading ? 'Sending reset link...' : 'Send reset link'}
            </button>
          </form>
        )}

        <Link
          to="/login"
          className="btn-ghost w-full justify-center mt-5"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
