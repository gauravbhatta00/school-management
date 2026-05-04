import React, { useEffect, useMemo, useState } from 'react'
import Calendar from 'react-calendar'
import toast from 'react-hot-toast'
import { communicationService, dashboardService, userService } from '../services/api'
import { FullPageSpinner, StatCard, StatusBadge } from '../components/common'
import { useAuth } from '../hooks'
import { toMediaUrl } from '../utils/media'

const CALENDAR_LEGEND = [
  { key: 'holiday', label: 'Holiday', dotClass: 'calendar-dot-holiday' },
  { key: 'activity', label: 'Activity', dotClass: 'calendar-dot-activity' },
  { key: 'meeting', label: 'Meeting', dotClass: 'calendar-dot-meeting' },
  { key: 'exam', label: 'Exam', dotClass: 'calendar-dot-exam' },
  { key: 'other', label: 'Other', dotClass: 'calendar-dot-other' },
  { key: 'weekend', label: 'Saturday Leave', dotClass: 'calendar-dot-weekend' },
]

export default function StudentPortal() {
  const { user, refreshUser } = useAuth()
  const [data, setData] = useState(null)
  const [notices, setNotices] = useState([])
  const [events, setEvents] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    Promise.all([
      dashboardService.studentPortal(),
      communicationService.notices(),
      communicationService.events(),
    ])
      .then(([portalRes, noticesRes, eventsRes]) => {
        setData(portalRes.data)
        setNotices(noticesRes.data?.results ?? noticesRes.data ?? [])
        setEvents(eventsRes.data?.results ?? eventsRes.data ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const topExam = useMemo(() => {
    const first = data?.exams?.exam_summaries?.[0]
    if (!first) return null
    return {
      name: first.exam_name,
      percentage: first.percentage,
    }
  }, [data])

  const eventsByDate = useMemo(() => {
    const byDate = {}
    for (const evt of events) {
      const spanDates = getDatesInRange(evt.start_date, evt.end_date)
      for (const dateKey of spanDates) {
        if (!byDate[dateKey]) byDate[dateKey] = []
        byDate[dateKey].push(evt)
      }
    }
    return byDate
  }, [events])

  const selectedDateKey = toDateKey(selectedDate)
  const selectedDayEvents = useMemo(() => {
    const baseEvents = [...(eventsByDate[selectedDateKey] || [])].sort(
      (a, b) => new Date(a.start_date) - new Date(b.start_date)
    )
    if (isSaturday(selectedDate)) {
      baseEvents.unshift({
        id: `saturday-leave-${selectedDateKey}`,
        title: 'Regular Leave Day',
        start_date: selectedDateKey,
        end_date: selectedDateKey,
      })
    }
    return baseEvents
  }, [eventsByDate, selectedDateKey])

  if (loading) return <FullPageSpinner />

  const attendance = data?.attendance || {}
  const fees = data?.fees || {}
  const student = data?.student || {}

  const handlePhotoUpdate = async (file) => {
    if (!file) return
    const payload = new FormData()
    payload.append('profile_photo', file)

    setUploadingPhoto(true)
    try {
      await userService.updateMe(payload)
      await refreshUser()
      toast.success('Profile photo updated')
    } catch {
      toast.error('Failed to update profile photo')
    } finally {
      setUploadingPhoto(false)
    }
  }
  const feeRequired = Number(fees.required || 0)
  const feePaid = Number(fees.paid || 0)
  const feeBalance = Number(fees.balance || 0)
  const feeStatus = feeBalance <= 0 ? 'paid' : feePaid > 0 ? 'partial' : 'pending'
  const latestPayment = fees.recent_payments?.[0]

  return (
    <div className="space-y-6 animate-fade-in">
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)', border: '1px solid rgba(45,212,191,0.25)' }}
      >
        <div
          className="absolute -right-12 -top-12 w-40 h-40 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #5eead4, transparent)' }}
        />
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
                Welcome, {student.name || 'Student'}
              </h2>
              <p className="text-teal-100 text-sm mt-1">
                Class {student.class_name || '-'}-{student.section || '-'} | Roll No: {student.roll_number || '-'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {user?.profile_photo ? (
                <img
                  src={toMediaUrl(user.profile_photo)}
                  alt="Student profile"
                  className="w-14 h-14 rounded-full object-cover border border-white/30"
                />
              ) : (
                <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg text-white border border-white/30">
                  {student.name?.[0] || 'S'}
                </div>
              )}
              <label className="btn-ghost cursor-pointer text-xs px-3 py-1.5" style={{ color: '#d1fae5' }}>
                {uploadingPhoto ? 'Uploading…' : 'Update Photo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    handlePhotoUpdate(e.target.files?.[0])
                    e.target.value = ''
                  }}
                  disabled={uploadingPhoto}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Attendance"
          value={`${attendance.attendance_rate ?? 0}%`}
          sub={`${attendance.present ?? 0} present of ${attendance.total_days ?? 0}`}
          color="#14b8a6"
          icon={<CheckIcon />}
        />
        <StatCard
          label="Absent"
          value={attendance.absent ?? 0}
          sub={`${attendance.leave ?? 0} leave days`}
          color="#ef4444"
          icon={<AbsentIcon />}
        />
        <StatCard
          label="Fees Paid"
          value={`₹${Number(fees.paid || 0).toLocaleString('en-IN')}`}
          sub={`Balance ₹${Number(fees.balance || 0).toLocaleString('en-IN')}`}
          color="#3b82f6"
          icon={<CashIcon />}
        />
        <StatCard
          label="Best Exam"
          value={topExam ? `${topExam.percentage}%` : 'N/A'}
          sub={topExam ? topExam.name : 'No results yet'}
          color="#f59e0b"
          icon={<ExamIcon />}
        />
      </div>

      <div className="card">
        <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Fee Status Summary ({fees.academic_year || 'N/A'})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-hover)' }}>
            <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Due Amount</p>
            <p className="text-3xl font-bold mt-1" style={{ color: feeBalance > 0 ? 'var(--danger)' : 'var(--success)', fontFamily: 'Syne, sans-serif' }}>
              ₹{feeBalance.toLocaleString('en-IN')}
            </p>
            <div className="mt-2"><StatusBadge status={feeStatus} /></div>
          </div>
          <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--bg-hover)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Total Fee: <span style={{ color: 'var(--text-primary)' }}>₹{feeRequired.toLocaleString('en-IN')}</span>
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Paid So Far: <span style={{ color: 'var(--text-primary)' }}>₹{feePaid.toLocaleString('en-IN')}</span>
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {latestPayment
                ? `Last Payment: ${formatDate(latestPayment.payment_date)} (${String(latestPayment.payment_method || '').toUpperCase()})`
                : 'Last Payment: Not available'}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Exam Performance
        </h3>
        {!data?.exams?.exam_summaries?.length ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No exam performance data available.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Total Obtained</th>
                  <th>Total Max</th>
                  <th>Percentage</th>
                </tr>
              </thead>
              <tbody>
                {data.exams.exam_summaries.map((exam) => (
                  <tr key={exam.exam_id}>
                    <td>{exam.exam_name}</td>
                    <td>{Number(exam.total_obtained).toFixed(2)}</td>
                    <td>{Number(exam.total_max).toFixed(2)}</td>
                    <td>{Number(exam.percentage).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            School Notices
          </h3>
          {notices.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No notices available.</p>
          ) : (
            <div className="space-y-2">
              {notices.slice(0, 4).map((notice) => (
                <div key={notice.id} className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-hover)' }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{notice.title}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{notice.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            School Calendar
          </h3>
          <div className="calendar-shell">
            <Calendar
              onClickDay={setSelectedDate}
              value={selectedDate}
              className="school-calendar"
              tileClassName={({ date }) => {
                const key = toDateKey(date)
                const todayKey = toDateKey(new Date())
                const classes = []
                if (key === todayKey) classes.push('calendar-day-today')
                if (isSaturday(date)) classes.push('calendar-day-saturday')
                return classes.join(' ')
              }}
              tileContent={({ date, view }) => {
                if (view !== 'month') return null
                const key = toDateKey(date)
                const dayEvents = eventsByDate[key] || []
                const markers = isSaturday(date)
                  ? [{ id: `weekend-${key}`, event_type: 'weekend', title: 'Regular Leave Day' }, ...dayEvents]
                  : dayEvents
                if (!markers.length) return null

                return (
                  <div className="calendar-dots">
                    {markers.slice(0, 3).map((evt, idx) => (
                      <span
                        key={`${evt.id}-${idx}`}
                        className={`calendar-dot calendar-dot-${evt.event_type || 'other'}`}
                        title={evt.title}
                      />
                    ))}
                  </div>
                )
              }}
            />
          </div>
          <div className="calendar-legend mt-3">
            {CALENDAR_LEGEND.map((item) => (
              <div key={item.key} className="calendar-legend-item">
                <span className={`calendar-dot ${item.dotClass}`} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {`Agenda ${formatDate(selectedDate)}`}
            </p>
            {selectedDayEvents.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No events for this date.</p>
            ) : (
              selectedDayEvents.slice(0, 3).map((event) => (
                <div key={event.id} className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-hover)' }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{event.title}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {formatDate(event.start_date)} - {formatDate(event.end_date)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function toDateKey(dateValue) {
  const date = new Date(dateValue)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getDatesInRange(start, end) {
  if (!start || !end) return []
  const startDate = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T00:00:00`)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return []

  const dates = []
  const cursor = new Date(startDate)
  while (cursor <= endDate) {
    dates.push(toDateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

function isSaturday(dateValue) {
  return new Date(dateValue).getDay() === 6
}

function formatDate(value) {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
)

const AbsentIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-3.707-6.293a1 1 0 011.414-1.414L10 8.586l2.293-2.293a1 1 0 111.414 1.414L11.414 10l2.293 2.293a1 1 0 01-1.414 1.414L10 11.414l-2.293 2.293a1 1 0 01-1.414-1.414L8.586 10 6.293 7.707z" clipRule="evenodd" />
  </svg>
)

const CashIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
    <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
  </svg>
)

const ExamIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
  </svg>
)
