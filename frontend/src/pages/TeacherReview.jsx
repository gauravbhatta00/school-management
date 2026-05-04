import { useState, useEffect } from 'react'
import { applicationService } from '../services/api'
import toast from 'react-hot-toast'

export default function TeacherReview() {
  const [applications, setApplications] = useState([])
  const [selectedApp, setSelectedApp] = useState(null)
  const [loading, setLoading] = useState(false)
  const [reviewData, setReviewData] = useState({
    teacher_review: '',
    teacher_decision: '',
  })

  const statusColors = {
    pending: 'badge-yellow',
    approved: 'badge-green',
    rejected: 'badge-red',
    teacher_reviewed: 'badge-blue',
  }

  useEffect(() => {
    fetchPendingApplications()
  }, [])

  const fetchPendingApplications = async () => {
    try {
      setLoading(true)
      const response = await applicationService.pendingReview()
      setApplications(response.data)
    } catch (error) {
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitReview = async () => {
    if (!reviewData.teacher_decision) {
      toast.error('Please select a decision (Approve or Reject)')
      return
    }

    try {
      setLoading(true)
      await applicationService.teacherResponse(selectedApp.id, reviewData)
      toast.success('Review submitted successfully')
      setSelectedApp(null)
      setReviewData({
        teacher_review: '',
        teacher_decision: '',
      })
      fetchPendingApplications()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit review')
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
        <div className="absolute -top-14 right-0 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gradient">Teacher Review Desk</h1>
            <p className="page-subtitle">Review incoming student applications and respond with clear decisions.</p>
          </div>
          <button onClick={fetchPendingApplications} className="btn btn-primary">Refresh Queue</button>
        </div>
      </div>

      {applications.length > 0 && (
        <div className="card border-blue-500/25 bg-blue-500/10">
          <p className="text-sm text-blue-100">
            You have <strong>{applications.length}</strong> pending application
            {applications.length !== 1 ? 's' : ''} to review
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          {loading ? (
            <div className="card text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            </div>
          ) : applications.length === 0 ? (
            <div className="card text-center p-8">
              <p className="text-[var(--text-secondary)]">No pending applications</p>
            </div>
          ) : (
            <div className="card space-y-3">
              <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Pending Queue</p>
              {applications.map((app) => (
                <button
                  key={app.id}
                  onClick={() => {
                    setSelectedApp(app)
                    setReviewData({
                      teacher_review: app.teacher_review || '',
                      teacher_decision: app.teacher_decision || '',
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
                    <span className={statusColors[app.status] || 'badge-gray'}>{getStatusLabel(app.status)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {selectedApp ? (
            <div className="card space-y-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">Review Application</h2>

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
                    <p className="text-xs uppercase tracking-wider text-indigo-200">Leave Period</p>
                    <p className="text-indigo-100">
                      {new Date(selectedApp.start_date).toLocaleDateString()} to{' '}
                      {new Date(selectedApp.end_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4 border-t border-[var(--border)] pt-4">
                <div>
                  <label className="label">Your Review Notes</label>
                  <textarea
                    value={reviewData.teacher_review}
                    onChange={(e) =>
                      setReviewData({ ...reviewData, teacher_review: e.target.value })
                    }
                    placeholder="Add your comments or findings..."
                    rows="4"
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Decision</label>
                  <div className="flex flex-col gap-3 md:flex-row">
                    <button
                      onClick={() =>
                        setReviewData({ ...reviewData, teacher_decision: 'approved' })
                      }
                      className={`btn flex-1 justify-center ${
                        reviewData.teacher_decision === 'approved'
                          ? 'bg-emerald-600 text-white'
                          : 'btn-ghost'
                      }`}
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() =>
                        setReviewData({ ...reviewData, teacher_decision: 'rejected' })
                      }
                      className={`btn flex-1 justify-center ${
                        reviewData.teacher_decision === 'rejected'
                          ? 'bg-red-600 text-white'
                          : 'btn-ghost'
                      }`}
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-500/35 bg-blue-500/10 p-3">
                  <p className="text-sm text-blue-100">
                    {selectedApp.application_type === 'leave_request'
                      ? 'Your decision will be final for leave requests.'
                      : 'Your review will be sent to the admin for final approval.'}
                  </p>
                </div>

                <button
                  onClick={handleSubmitReview}
                  disabled={loading || !reviewData.teacher_decision}
                  className="btn btn-primary w-full justify-center"
                >
                  {loading ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </div>
          ) : (
            <div className="card p-10 text-center">
              <p className="text-[var(--text-secondary)]">Select an application from the queue to review.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
