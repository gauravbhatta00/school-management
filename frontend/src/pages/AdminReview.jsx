import { useState, useEffect } from 'react'
import { applicationService } from '../services/api'
import toast from 'react-hot-toast'

export default function AdminReview() {
  const [applications, setApplications] = useState([])
  const [selectedApp, setSelectedApp] = useState(null)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [reviewData, setReviewData] = useState({
    admin_review: '',
    admin_decision: '',
  })

  const statusColors = {
    pending: 'badge-yellow',
    approved: 'badge-green',
    rejected: 'badge-red',
    teacher_reviewed: 'badge-blue',
  }

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [appsResponse, statsResponse] = await Promise.all([
        applicationService.pendingReview(),
        applicationService.stats(),
      ])
      setApplications(appsResponse.data)
      setStats(statsResponse.data)
    } catch (error) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitReview = async () => {
    if (!reviewData.admin_decision) {
      toast.error('Please select a decision (Approve or Reject)')
      return
    }

    try {
      setLoading(true)
      await applicationService.adminReview(selectedApp.id, reviewData)
      toast.success('Decision submitted successfully')
      setSelectedApp(null)
      setReviewData({
        admin_review: '',
        admin_decision: '',
      })
      fetchData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit decision')
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pt-2">
      <div className="card relative overflow-hidden">
        <div className="absolute -top-24 right-6 h-56 w-56 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute -bottom-20 left-6 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gradient">Application Command Center</h1>
            <p className="page-subtitle">Review teacher recommendations and issue final decisions.</p>
          </div>
          <button onClick={fetchData} className="btn btn-primary">Refresh Data</button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className="card bg-white/5">
            <p className="text-sm text-[var(--text-secondary)]">Total</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.total}</p>
          </div>
          <div className="card bg-amber-500/10">
            <p className="text-sm text-amber-200">Pending</p>
            <p className="text-2xl font-bold text-amber-100">{stats.pending}</p>
          </div>
          <div className="card bg-emerald-500/10">
            <p className="text-sm text-emerald-200">Approved</p>
            <p className="text-2xl font-bold text-emerald-100">{stats.approved}</p>
          </div>
          <div className="card bg-red-500/10">
            <p className="text-sm text-red-200">Rejected</p>
            <p className="text-2xl font-bold text-red-100">{stats.rejected}</p>
          </div>
          <div className="card bg-blue-500/10">
            <p className="text-sm text-blue-200">By Type</p>
            <p className="mt-2 text-xs text-blue-100">
              Leave: {stats.by_type.leave_requests}
              <br />
              Other: {stats.by_type.transfer_requests + stats.by_type.fee_waivers + stats.by_type.scholarships + stats.by_type.other}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          {loading && !selectedApp ? (
            <div className="card py-8 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            </div>
          ) : applications.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-[var(--text-secondary)]">No pending applications</p>
            </div>
          ) : (
            <div className="card space-y-3">
              <h3 className="px-1 font-semibold text-[var(--text-primary)]">
                Teacher-Reviewed Applications ({applications.length})
              </h3>
              {applications.map((app) => (
                <button
                  key={app.id}
                  onClick={() => {
                    setSelectedApp(app)
                    setReviewData({
                      admin_review: app.admin_review || '',
                      admin_decision: app.admin_decision || '',
                    })
                  }}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedApp?.id === app.id
                      ? 'border-indigo-400 bg-indigo-500/15'
                      : 'border-[var(--border)] bg-[var(--bg-secondary)] hover:border-indigo-500/40'
                  }`}
                >
                  <div className="truncate font-semibold text-[var(--text-primary)]">
                    {app.student_name}
                  </div>
                  <div className="truncate text-sm text-[var(--text-secondary)]">{app.title}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-[var(--text-secondary)]">
                      {app.application_type_display}
                    </span>
                    <span className={statusColors[app.status] || 'badge-gray'}>
                      {getStatusLabel(app.status)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {selectedApp ? (
            <div className="card space-y-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">Final Decision Panel</h2>

              <div className="grid grid-cols-1 gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Student</p>
                  <p className="font-semibold text-[var(--text-primary)]">{selectedApp.student_name}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Type</p>
                  <p className="font-semibold text-[var(--text-primary)]">
                    {selectedApp.application_type_display}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Title</p>
                  <p className="font-semibold text-[var(--text-primary)]">{selectedApp.title}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Description</p>
                  <p className="text-[var(--text-primary)]/90">{selectedApp.description}</p>
                </div>
                {selectedApp.start_date && selectedApp.end_date && (
                  <div className="md:col-span-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3">
                    <p className="text-xs uppercase tracking-wider text-indigo-200">Period</p>
                    <p className="text-indigo-100">
                      {new Date(selectedApp.start_date).toLocaleDateString()} to{' '}
                      {new Date(selectedApp.end_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {selectedApp.teacher_review && (
                <div className="rounded-xl border border-blue-500/35 bg-blue-500/10 p-4">
                  <p className="text-sm font-semibold text-blue-200">Teacher Review</p>
                  <p className="mt-1 text-blue-100/90">{selectedApp.teacher_review}</p>
                  <p className="mt-2 text-xs text-blue-200">
                    <strong>Decision:</strong> {selectedApp.teacher_decision}
                  </p>
                  {selectedApp.teacher_name && (
                    <p className="text-xs text-blue-200">
                      <strong>By:</strong> {selectedApp.teacher_name}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-4 border-t border-[var(--border)] pt-4">
                <div>
                  <label className="label">Your Final Review Notes</label>
                  <textarea
                    value={reviewData.admin_review}
                    onChange={(e) =>
                      setReviewData({ ...reviewData, admin_review: e.target.value })
                    }
                    placeholder="Add your comments or decision reasoning..."
                    rows="4"
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Final Decision</label>
                  <div className="flex flex-col gap-3 md:flex-row">
                    <button
                      onClick={() =>
                        setReviewData({ ...reviewData, admin_decision: 'approved' })
                      }
                      className={`btn flex-1 justify-center ${
                        reviewData.admin_decision === 'approved'
                          ? 'bg-emerald-600 text-white'
                          : 'btn-ghost'
                      }`}
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() =>
                        setReviewData({ ...reviewData, admin_decision: 'rejected' })
                      }
                      className={`btn flex-1 justify-center ${
                        reviewData.admin_decision === 'rejected'
                          ? 'bg-red-600 text-white'
                          : 'btn-ghost'
                      }`}
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleSubmitReview}
                  disabled={loading || !reviewData.admin_decision}
                  className="btn btn-primary w-full justify-center"
                >
                  {loading ? 'Processing...' : 'Submit Final Decision'}
                </button>
              </div>
            </div>
          ) : (
            <div className="card p-10 text-center">
              <p className="text-[var(--text-secondary)]">Select an application to review and decide.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
