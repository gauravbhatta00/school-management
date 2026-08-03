import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import { communicationService } from '../services/api'
import { useAuth } from '../hooks'
import SchoolCalendar from '../components/calendar/SchoolCalendar'
import { toDateKey, isSaturday, groupEventsByDate, getDayAgenda } from '../utils/calendarHelpers'

const EVENT_BADGES = {
  exam: 'badge-blue',
  holiday: 'badge-green',
  meeting: 'badge-yellow',
  activity: 'badge-purple',
  other: 'badge-gray',
}

export default function CalendarHub() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'

  const [loading, setLoading] = useState(false)
  const [notices, setNotices] = useState([])
  const [events, setEvents] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showEventForm, setShowEventForm] = useState(false)

  const [noticeForm, setNoticeForm] = useState({
    title: '',
    message: '',
    is_published: true,
  })

  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'other',
    start_date: '',
    end_date: '',
  })

  const upcomingEvents = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return [...events]
      .filter((evt) => {
        const end = new Date(evt.end_date)
        return !Number.isNaN(end.getTime()) && end >= today
      })
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
      .slice(0, 8)
  }, [events])

  const eventsByDate = useMemo(() => groupEventsByDate(events), [events])

  const selectedDayEvents = useMemo(
    () => getDayAgenda(eventsByDate, selectedDate),
    [eventsByDate, selectedDate]
  )

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [noticeRes, eventRes] = await Promise.all([
        communicationService.notices(),
        communicationService.events(),
      ])

      const noticePayload = noticeRes.data?.results ?? noticeRes.data ?? []
      const eventPayload = eventRes.data?.results ?? eventRes.data ?? []

      setNotices(Array.isArray(noticePayload) ? noticePayload : [])
      setEvents(Array.isArray(eventPayload) ? eventPayload : [])
    } catch {
      toast.error('Failed to load notices and calendar events')
    } finally {
      setLoading(false)
    }
  }

  const handlePublishNotice = async (e) => {
    e.preventDefault()
    if (!noticeForm.title || !noticeForm.message) {
      toast.error('Notice title and message are required')
      return
    }

    try {
      await communicationService.createNotice(noticeForm)
      toast.success('Notice published')
      setNoticeForm({ title: '', message: '', is_published: true })
      fetchData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to publish notice')
    }
  }

  const handleCreateEvent = async (e) => {
    e.preventDefault()
    if (!eventForm.title || !eventForm.start_date || !eventForm.end_date) {
      toast.error('Event title, start date, and end date are required')
      return
    }
    if (new Date(eventForm.end_date) < new Date(eventForm.start_date)) {
      toast.error('Event end date cannot be before start date')
      return
    }

    try {
      await communicationService.createEvent(eventForm)
      toast.success('Calendar event created')
      setShowEventForm(false)
      setEventForm({
        title: '',
        description: '',
        event_type: 'other',
        start_date: '',
        end_date: '',
      })
      fetchData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create calendar event')
    }
  }

  const handleDateClick = (dateValue) => {
    setSelectedDate(dateValue)
    if (isAdmin) {
      const day = toDateKey(dateValue)
      setEventForm((prev) => ({
        ...prev,
        start_date: day,
        end_date: day,
      }))
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card relative overflow-hidden">
        <div className="absolute -top-16 -right-8 h-44 w-44 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute -bottom-16 -left-8 h-44 w-44 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="relative">
          <h1 className="text-3xl font-bold text-gradient">Notices & Calendar</h1>
          <p className="page-subtitle">School-wide announcements and upcoming events for admin, teachers, and students.</p>
        </div>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="card">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Publish Notice</h2>
            <form onSubmit={handlePublishNotice} className="mt-4 space-y-3">
              <div>
                <label className="label">Title</label>
                <input
                  className="input"
                  value={noticeForm.title}
                  onChange={(e) => setNoticeForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Exam schedule update"
                />
              </div>
              <div>
                <label className="label">Message</label>
                <textarea
                  className="input"
                  rows="4"
                  value={noticeForm.message}
                  onChange={(e) => setNoticeForm((prev) => ({ ...prev, message: e.target.value }))}
                  placeholder="Type the notice details for your school..."
                />
              </div>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={noticeForm.is_published}
                  onChange={(e) => setNoticeForm((prev) => ({ ...prev, is_published: e.target.checked }))}
                />
                Publish immediately
              </label>
              <button className="btn btn-primary" type="submit">Publish Notice</button>
            </form>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Calendar</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Click a date, then use Create Event to add holiday, activity, or event.
            </p>
            <div className="mt-4">
              <SchoolCalendar events={events} selectedDate={selectedDate} onSelectDate={handleDateClick} />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowEventForm((prev) => !prev)}
              >
                {showEventForm ? 'Close Event Form' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && showEventForm && (
        <div className="card">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Add Calendar Event</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Selected date: {formatDate(selectedDate)}
          </p>
          <form onSubmit={handleCreateEvent} className="mt-4 space-y-3">
            <div>
              <label className="label">Event Title</label>
              <input
                className="input"
                value={eventForm.title}
                onChange={(e) => setEventForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Parent-teacher meeting"
              />
            </div>
            <div>
              <label className="label">Event Type</label>
              <select
                className="select"
                value={eventForm.event_type}
                onChange={(e) => setEventForm((prev) => ({ ...prev, event_type: e.target.value }))}
              >
                <option value="exam">Exam</option>
                <option value="holiday">Holiday</option>
                <option value="meeting">Meeting</option>
                <option value="activity">Activity</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                className="input"
                rows="3"
                value={eventForm.description}
                onChange={(e) => setEventForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input"
                  value={eventForm.start_date}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  className="input"
                  value={eventForm.end_date}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
            </div>
            <button className="btn btn-primary" type="submit">Save Event</button>
          </form>
        </div>
      )}

      {!isAdmin && (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card xl:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Calendar
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Selected: {formatDate(selectedDate)}
            </p>
          </div>

          <SchoolCalendar events={events} selectedDate={selectedDate} onSelectDate={handleDateClick} />
        </div>

        <div className="card">
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Agenda For {formatDate(selectedDate)}
          </h2>

          {!selectedDayEvents.length ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No events on this date.
            </p>
          ) : (
            <div className="space-y-2">
              {selectedDayEvents.map((evt) => (
                <div key={evt.id} className="rounded-lg px-3 py-2" style={{ background: 'var(--bg-hover)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{evt.title}</p>
                    <span className={EVENT_BADGES[evt.event_type] || 'badge-gray'}>{toLabel(evt.event_type)}</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {formatDate(evt.start_date)} - {formatDate(evt.end_date)}
                  </p>
                  {evt.description ? (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{evt.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Latest Notices
          </h2>
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading notices...</p>
          ) : notices.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No published notices available.</p>
          ) : (
            <div className="space-y-3">
              {notices.slice(0, 10).map((notice) => (
                <div key={notice.id} className="rounded-xl px-3 py-3" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{notice.title}</p>
                    <span className={notice.is_published ? 'badge-green' : 'badge-gray'}>
                      {notice.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{notice.message}</p>
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    {formatDateTime(notice.published_at || notice.created_at)}
                    {notice.created_by_name ? ` | By ${notice.created_by_name}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Upcoming Calendar
          </h2>
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading events...</p>
          ) : upcomingEvents.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No upcoming events found.</p>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((evt) => (
                <div key={evt.id} className="rounded-xl px-3 py-3" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{evt.title}</p>
                    <span className={EVENT_BADGES[evt.event_type] || 'badge-gray'}>
                      {toLabel(evt.event_type)}
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {formatDate(evt.start_date)} - {formatDate(evt.end_date)}
                  </p>
                  {evt.description ? (
                    <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{evt.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function toLabel(value) {
  if (!value) return 'Other'
  return value.charAt(0).toUpperCase() + value.slice(1)
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

function formatDateTime(value) {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
