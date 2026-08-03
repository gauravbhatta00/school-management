import { useState, useEffect } from 'react'
import { applicationService } from '../services/api'
import toast from 'react-hot-toast'

export default function Applications() {
  const [applications, setApplications] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    application_type: 'leave_request',
    title: '',
    description: '',
    start_date: '',
    end_date: '',
  })

  const applicationTypes = [
    { value: 'leave_request', label: 'Leave Request' },
    { value: 'transfer_request', label: 'Transfer Request' },
    { value: 'fee_waiver', label: 'Fee Waiver' },
    { value: 'scholarship', label: 'Scholarship' },
    { value: 'other', label: 'Other' },
  ]

  const statusColors = {
    pending: 'badge-yellow',
    approved: 'badge-green',
    rejected: 'badge-red',
    teacher_reviewed: 'badge-blue',
  }

  useEffect(() => {
    fetchApplications()
  }, [])

  const fetchApplications = async () => {
    try {
      setLoading(true)
      const response = await applicationService.myApplications()
      setApplications(response.data)
    } catch (error) {
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.title || !formData.description) {
      toast.error('Please fill in all required fields')
      return
    }

    if (formData.application_type === 'leave_request') {
      if (!formData.start_date || !formData.end_date) {
        toast.error('Start and end dates are required for leave requests')
        return
      }
      if (new Date(formData.end_date) < new Date(formData.start_date)) {
        toast.error('End date must be after start date')
        return
      }
    }

    const payload = {
      ...formData,
      start_date: formData.application_type === 'leave_request' ? formData.start_date : null,
      end_date: formData.application_type === 'leave_request' ? formData.end_date : null,
    }

    try {
      setLoading(true)
      await applicationService.create(payload)
      toast.success('Application submitted successfully')
      setShowForm(false)
      setFormData({
        application_type: 'leave_request',
        title: '',
        description: '',
        start_date: '',
        end_date: '',
      })
      fetchApplications()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit application')
    } finally {
      setLoading(false)
    }
  }

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      teacher_reviewed: 'Teacher Reviewed',
    }
    return labels[status] || status
  }

  const statCards = [
    {
      label: 'Total',
      value: applications.length,
      className: 'bg-white/5',
    },
    {
      label: 'Pending',
      value: applications.filter((a) => a.status === 'pending' || a.status === 'teacher_reviewed').length,
      className: 'bg-amber-500/10',
    },
    {
      label: 'Approved',
      value: applications.filter((a) => a.status === 'approved').length,
      className: 'bg-emerald-500/10',
    },
    {
      label: 'Rejected',
      value: applications.filter((a) => a.status === 'rejected').length,
      className: 'bg-red-500/10',
    },
  ]

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pt-2">
      <div className="card relative overflow-hidden">
        <div className="absolute -top-20 -right-10 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-52 w-52 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gradient">My Applications</h1>
            <p className="page-subtitle">Submit requests, track status, and view reviewer feedback.</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className={showForm ? 'btn btn-ghost' : 'btn btn-primary'}>
            {showForm ? 'Close Form' : 'New Application'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className={`card ${card.className}`}>
            <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{card.value}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card animate-[fadeIn_.2s_ease-out]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Submit Application</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Describe your request clearly so reviewers can decide quickly.</p>
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="label">Application Type</label>
              <select
                value={formData.application_type}
                onChange={(e) =>
                  setFormData({ ...formData, application_type: e.target.value })
                }
                className="select"
              >
                {applicationTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g., Medical Leave Request"
                className="input"
              />
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Provide details about your application..."
                rows="4"
                className="input"
              />
            </div>

            {formData.application_type === 'leave_request' && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Start Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData({ ...formData, start_date: e.target.value })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) =>
                      setFormData({ ...formData, end_date: e.target.value })
                    }
                    className="input"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={loading} className="btn btn-primary">
                {loading ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && !showForm ? (
        <div className="card text-center py-10">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Loading applications...</p>
        </div>
      ) : applications.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-[var(--text-secondary)]">No applications yet. Submit your first request.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {applications.map((app) => (
            <div
              key={app.id}
              className="card-hover"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)]">{app.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)]">{app.application_type_display}</p>
                </div>
                <span className={statusColors[app.status] || 'badge-gray'}>
                  {getStatusLabel(app.status)}
                </span>
              </div>

              <p className="mb-4 text-sm text-[var(--text-primary)]/90">{app.description}</p>

              {app.start_date && app.end_date && (
                <div className="mb-4 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-200">
                  <p>
                    Period: {new Date(app.start_date).toLocaleDateString()} to{' '}
                    {new Date(app.end_date).toLocaleDateString()}
                  </p>
                </div>
              )}

              <div className="mb-4 grid grid-cols-1 gap-2 border-t border-[var(--border)] pt-3 text-sm md:grid-cols-2">
                <div>
                  <p className="text-[var(--text-secondary)]">
                    Submitted: {new Date(app.created_at).toLocaleDateString()}
                  </p>
                </div>
                {app.teacher_reviewed_at && (
                  <div>
                    <p className="text-[var(--text-secondary)]">
                      Teacher Review:{' '}
                      {new Date(app.teacher_reviewed_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {app.teacher_review && (
                <div className="mb-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm">
                  <p className="font-semibold text-blue-300">Teacher Review</p>
                  <p className="mt-1 text-blue-100/90">{app.teacher_review}</p>
                </div>
              )}

              {app.admin_review && (
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-sm">
                  <p className="font-semibold text-violet-300">Admin Review</p>
                  <p className="mt-1 text-violet-100/90">{app.admin_review}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
