import React, { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import Calendar from 'react-calendar'
import toast from 'react-hot-toast'
import { communicationService, dashboardService, userService } from '../services/api'
import { useAuth } from '../hooks'
import { StatCard, FullPageSpinner } from '../components/common'
import { toMediaUrl } from '../utils/media'

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6']
const CALENDAR_LEGEND = [
  { key: 'holiday', label: 'Holiday', dotClass: 'calendar-dot-holiday' },
  { key: 'activity', label: 'Activity', dotClass: 'calendar-dot-activity' },
  { key: 'meeting', label: 'Meeting', dotClass: 'calendar-dot-meeting' },
  { key: 'exam', label: 'Exam', dotClass: 'calendar-dot-exam' },
  { key: 'other', label: 'Other', dotClass: 'calendar-dot-other' },
  { key: 'weekend', label: 'Saturday Leave', dotClass: 'calendar-dot-weekend' },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-xl px-3 py-2 text-sm"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <p style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{payload[0].value}</p>
    </div>
  )
}

export default function Dashboard() {
  const { user, isAdmin, isTeacher, refreshUser } = useAuth()
  const [stats,   setStats]   = useState(null)
  const [notices, setNotices] = useState([])
  const [events, setEvents] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    Promise.all([
      dashboardService.stats(),
      communicationService.notices(),
      communicationService.events(),
    ])
      .then(([statsRes, noticesRes, eventsRes]) => {
        setStats(statsRes.data)
        setNotices(noticesRes.data?.results ?? noticesRes.data ?? [])
        setEvents(eventsRes.data?.results ?? eventsRes.data ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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

  if (loading) return <FullPageSpinner />

  const attRate = stats?.attendance?.attendance_rate ?? 0
  const chartData = stats
    ? [
        { label: 'Students', value: stats.total_students },
        { label: 'Teachers', value: stats.total_teachers },
        { label: 'Present', value: stats.attendance?.present_today ?? 0 },
        { label: 'Absent',  value: stats.attendance?.absent_today  ?? 0 },
      ]
    : []

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Welcome banner ── */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #3730a3 0%, #1e1b4b 100%)', border: '1px solid rgba(99,102,241,0.3)' }}
      >
        <div
          className="absolute -right-12 -top-12 w-48 h-48 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #818cf8, transparent)' }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              Good {getGreeting()}, {user?.first_name}! 👋
            </h2>
            <p className="text-indigo-300 text-sm mt-1">
              {user?.school_name} · Here's what's happening today
            </p>
          </div>

          {isTeacher && (
            <div className="flex items-center gap-3">
              {user?.profile_photo ? (
                <img
                  src={toMediaUrl(user.profile_photo)}
                  alt="Teacher profile"
                  className="w-12 h-12 rounded-full object-cover border border-white/25"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white border border-white/25"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                >
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </div>
              )}

              <label className="btn-ghost cursor-pointer text-xs px-3 py-1.5" style={{ color: '#c7d2fe' }}>
                {uploadingPhoto ? 'Uploading...' : 'Update Photo'}
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
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Students"
          value={stats?.total_students ?? '—'}
          sub="Enrolled this year"
          color="#6366f1"
          icon={<PeopleIcon />}
        />
        <StatCard
          label="Total Teachers"
          value={stats?.total_teachers ?? '—'}
          sub="Active staff"
          color="#10b981"
          icon={<TeacherIcon />}
        />
        <StatCard
          label="Present Today"
          value={stats?.attendance?.present_today ?? '—'}
          sub={`${attRate}% attendance rate`}
          color="#f59e0b"
          icon={<CheckIcon />}
        />
        <StatCard
          label="Fee Collected"
          value={`₹${((stats?.fees?.total_collected ?? 0) / 1000).toFixed(0)}K`}
          sub={`₹${((stats?.fees?.pending_amount ?? 0) / 1000).toFixed(0)}K pending`}
          color="#3b82f6"
          icon={<CashIcon />}
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart */}
        <div className="card lg:col-span-2">
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Today's Snapshot
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={28} barCategoryGap="30%">
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Attendance donut replacement — ring meter */}
        <div className="card flex flex-col items-center justify-center gap-3">
          <h3 className="text-sm font-bold self-start" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Attendance Rate
          </h3>
          <AttendanceRing rate={attRate} />
          <div className="flex gap-4 mt-2">
            <Dot color="#10b981" label={`Present ${stats?.attendance?.present_today ?? 0}`} />
            <Dot color="#ef4444" label={`Absent ${stats?.attendance?.absent_today ?? 0}`} />
          </div>
        </div>
      </div>

      {/* ── Quick tips for non-admins ── */}
      {!isAdmin && (
        <div
          className="rounded-xl px-5 py-4 text-sm"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          💡 Use the <b style={{ color: 'var(--text-primary)' }}>Attendance</b> page to mark today's class,
          or <b style={{ color: 'var(--text-primary)' }}>Examinations</b> to enter results.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Latest Notices
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
            Calendar
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
                    {event.start_date} - {event.end_date}
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function Dot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
      <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
      {label}
    </div>
  )
}

function AttendanceRing({ rate }) {
  const r = 54
  const circumference = 2 * Math.PI * r
  const offset = circumference - (rate / 100) * circumference

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <circle
          cx="64" cy="64" r={r}
          fill="none"
          stroke="url(#grad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>
      <div className="text-center">
        <p className="text-3xl font-bold text-gradient" style={{ fontFamily: 'Syne, sans-serif' }}>
          {rate}%
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>today</p>
      </div>
    </div>
  )
}

const PeopleIcon  = () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
const TeacherIcon = () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/></svg>
const CheckIcon   = () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
const CashIcon    = () => <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/></svg>
