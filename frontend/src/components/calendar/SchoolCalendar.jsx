import { useMemo } from 'react'
import Calendar from 'react-calendar'

import { toDateKey, isSaturday, groupEventsByDate, getDayMarkers, CALENDAR_LEGEND } from '../../utils/calendarHelpers'

function ChevronIcon({ direction }) {
  const d =
    direction === 'left'
      ? 'M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z'
      : 'M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z'
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d={d} clipRule="evenodd" />
    </svg>
  )
}

function DoubleChevronIcon({ direction }) {
  return (
    <span className="calendar-nav-double">
      <ChevronIcon direction={direction} />
      <ChevronIcon direction={direction} />
    </span>
  )
}

/**
 * Shared month-view calendar used across Dashboard, Student Portal, and the
 * Notices & Calendar page — keeps the look and event-marker logic in one place.
 */
export default function SchoolCalendar({ events = [], selectedDate, onSelectDate, showLegend = true }) {
  const eventsByDate = useMemo(() => groupEventsByDate(events), [events])

  return (
    <div className="calendar-shell">
      <Calendar
        onClickDay={onSelectDate}
        value={selectedDate}
        className="school-calendar"
        prevLabel={<ChevronIcon direction="left" />}
        nextLabel={<ChevronIcon direction="right" />}
        prev2Label={<DoubleChevronIcon direction="left" />}
        next2Label={<DoubleChevronIcon direction="right" />}
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
          const markers = getDayMarkers(eventsByDate, date)
          if (!markers.length) return null

          return (
            <div className="calendar-dots">
              {markers.slice(0, 3).map((evt, idx) => (
                <span
                  key={`${evt.id}-${idx}`}
                  className={`calendar-dot calendar-dot-${evt.event_type || 'other'}`}
                  title={`${evt.title} (${evt.event_type})`}
                />
              ))}
            </div>
          )
        }}
      />

      {showLegend && (
        <div className="calendar-legend mt-3">
          {CALENDAR_LEGEND.map((item) => (
            <div key={item.key} className="calendar-legend-item">
              <span className={`calendar-dot ${item.dotClass}`} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
