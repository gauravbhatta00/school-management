export function toDateKey(dateValue) {
  const date = new Date(dateValue)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isSaturday(dateValue) {
  return new Date(dateValue).getDay() === 6
}

export function getDatesInRange(start, end) {
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

export function groupEventsByDate(events) {
  const byDate = {}
  for (const evt of events) {
    const spanDates = getDatesInRange(evt.start_date, evt.end_date)
    for (const dateKey of spanDates) {
      if (!byDate[dateKey]) byDate[dateKey] = []
      byDate[dateKey].push(evt)
    }
  }
  return byDate
}

// Markers shown inside a calendar tile, including the synthetic Saturday-leave marker.
export function getDayMarkers(eventsByDate, dateValue) {
  const key = toDateKey(dateValue)
  const dayEvents = eventsByDate[key] || []
  if (isSaturday(dateValue)) {
    return [{ id: `weekend-${key}`, event_type: 'weekend', title: 'Regular Leave Day' }, ...dayEvents]
  }
  return dayEvents
}

// Sorted agenda list for a selected date, including the synthetic Saturday-leave entry.
export function getDayAgenda(eventsByDate, dateValue) {
  const key = toDateKey(dateValue)
  const baseEvents = [...(eventsByDate[key] || [])].sort(
    (a, b) => new Date(a.start_date) - new Date(b.start_date)
  )
  if (isSaturday(dateValue)) {
    baseEvents.unshift({
      id: `saturday-leave-${key}`,
      title: 'Regular Leave Day',
      event_type: 'holiday',
      start_date: key,
      end_date: key,
      description: 'Saturday is a regular leave day.',
    })
  }
  return baseEvents
}

export const CALENDAR_LEGEND = [
  { key: 'holiday', label: 'Holiday', dotClass: 'calendar-dot-holiday' },
  { key: 'activity', label: 'Activity', dotClass: 'calendar-dot-activity' },
  { key: 'meeting', label: 'Meeting', dotClass: 'calendar-dot-meeting' },
  { key: 'exam', label: 'Exam', dotClass: 'calendar-dot-exam' },
  { key: 'other', label: 'Other', dotClass: 'calendar-dot-other' },
  { key: 'weekend', label: 'Saturday Leave', dotClass: 'calendar-dot-weekend' },
]
