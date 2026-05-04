import React, { useState, useEffect, useCallback } from 'react'
import { attendanceService, studentService, userService } from '../services/api'
import { StatusBadge, FullPageSpinner, Spinner } from '../components/common'
import { useAuth } from '../hooks'
import toast from 'react-hot-toast'

const CLASSES  = ['8', '9', '10', '11', '12']
const SECTIONS = ['A', 'B', 'C', 'D']
const today    = () => new Date().toISOString().split('T')[0]

export default function Attendance() {
  const { isTeacher, isAdmin } = useAuth()
  const [tab,      setTab]      = useState('mark')   // 'mark' | 'report'
  const [cls,      setCls]      = useState('10')
  const [sec,      setSec]      = useState('A')
  const [date,     setDate]     = useState(today())
  const [students, setStudents] = useState([])
  const [marks,    setMarks]    = useState({})       // { studentId: 'present'|'absent'|'leave' }
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)

  // Teacher self-attendance state
  const [selfDate,    setSelfDate]    = useState(today())
  const [selfStatus,  setSelfStatus]  = useState('present')
  const [selfRemarks, setSelfRemarks] = useState('')
  const [selfHistory, setSelfHistory] = useState([])
  const [selfSaving,  setSelfSaving]  = useState(false)
  const [selfLoading, setSelfLoading] = useState(false)

  // Admin teacher-attendance state
  const [teacherDate,    setTeacherDate]    = useState(today())
  const [teachers,       setTeachers]       = useState([])
  const [teacherMarks,   setTeacherMarks]   = useState({})
  const [teacherLoading, setTeacherLoading] = useState(false)
  const [teacherSaving,  setTeacherSaving]  = useState(false)
  const [teacherMonthSummary, setTeacherMonthSummary] = useState({ total: 0, present: 0, absent: 0, leave: 0, rate: 0 })

  // Report tab state
  const [report,      setReport]      = useState([])
  const [rptLoading,  setRptLoading]  = useState(false)
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')

  // Load students for the selected class/section
  const loadStudents = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await studentService.list({ class_name: cls, section: sec, page_size: 100 })
      const list = data.results ?? data
      setStudents(list)

      // Pre-load existing attendance for this date
      const { data: att } = await attendanceService.list({
        student__class_name: cls, student__section: sec,
        date, page_size: 100
      })
      const existing = {}
      ;(att.results ?? att).forEach(a => { existing[a.student] = a.status })

      // Default unmarked → present
      const defaults = {}
      list.forEach(s => { defaults[s.id] = existing[s.id] || 'present' })
      setMarks(defaults)
    } finally {
      setLoading(false)
    }
  }, [cls, sec, date])

  useEffect(() => { if (tab === 'mark') loadStudents() }, [loadStudents, tab])

  useEffect(() => {
    if (!isTeacher) return
    const loadSelfAttendance = async () => {
      setSelfLoading(true)
      try {
        const { data } = await attendanceService.teacherSelf.list()
        setSelfHistory(data)
      } catch {
        toast.error('Failed to load your attendance history')
      } finally {
        setSelfLoading(false)
      }
    }
    loadSelfAttendance()
  }, [isTeacher])

  useEffect(() => {
    if (!isAdmin) return

    const loadTeacherAttendance = async () => {
      setTeacherLoading(true)
      try {
        const [{ data: users }, { data: attendance }] = await Promise.all([
          userService.list({ role: 'teacher', page_size: 100 }),
          attendanceService.teacherRecords.list({ date: teacherDate }),
        ])

        const { data: monthData } = await attendanceService.teacherRecords.list({ month: teacherDate.slice(0, 7) })

        const teacherUsers = users.results ?? users ?? []
        const attendanceRows = attendance.results ?? attendance ?? []
        const monthRows = monthData.results ?? monthData ?? []
        const existing = {}
        attendanceRows.forEach((row) => {
          existing[row.teacher] = row.status
        })

        const monthStats = monthRows.reduce(
          (acc, row) => {
            acc.total += 1
            if (row.status === 'present') acc.present += 1
            if (row.status === 'absent') acc.absent += 1
            if (row.status === 'leave') acc.leave += 1
            return acc
          },
          { total: 0, present: 0, absent: 0, leave: 0 }
        )

        setTeacherMonthSummary({
          ...monthStats,
          rate: monthStats.total ? Math.round((monthStats.present / monthStats.total) * 100) : 0,
        })

        setTeachers(teacherUsers)
        const defaults = {}
        teacherUsers.forEach((teacher) => {
          defaults[teacher.id] = existing[teacher.id] || 'present'
        })
        setTeacherMarks(defaults)
      } catch {
        toast.error('Failed to load teacher attendance')
      } finally {
        setTeacherLoading(false)
      }
    }

    loadTeacherAttendance()
  }, [isAdmin, teacherDate])

  const setMark = (studentId, status) =>
    setMarks(m => ({ ...m, [studentId]: status }))

  const markAll = (status) => {
    const all = {}
    students.forEach(s => { all[s.id] = status })
    setMarks(all)
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const records = students.map(s => ({
        student_id: s.id,
        status: marks[s.id] || 'present',
      }))
      await attendanceService.bulkMark({ date, records })
      toast.success(`Attendance saved for Class ${cls}-${sec}`)
    } catch {
      toast.error('Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  const handleSelfSubmit = async () => {
    setSelfSaving(true)
    try {
      await attendanceService.teacherSelf.save({
        date: selfDate,
        status: selfStatus,
        remarks: selfRemarks,
      })
      toast.success('Your attendance has been saved')
      const { data } = await attendanceService.teacherSelf.list()
      setSelfHistory(data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save your attendance')
    } finally {
      setSelfSaving(false)
    }
  }

  const setTeacherMark = (teacherId, status) => {
    setTeacherMarks((current) => ({ ...current, [teacherId]: status }))
  }

  const markAllTeachers = (status) => {
    const all = {}
    teachers.forEach((teacher) => {
      all[teacher.id] = status
    })
    setTeacherMarks(all)
  }

  const handleTeacherSubmit = async () => {
    setTeacherSaving(true)
    try {
      const records = teachers.map((teacher) => ({
        teacher_id: teacher.id,
        status: teacherMarks[teacher.id] || 'present',
      }))
      await attendanceService.teacherRecords.save({ date: teacherDate, records })
      toast.success('Teacher attendance saved')
      const { data } = await attendanceService.teacherRecords.list({ date: teacherDate })
      const attendanceRows = data.results ?? data ?? []
      const existing = {}
      attendanceRows.forEach((row) => {
        existing[row.teacher] = row.status
      })
      const defaults = {}
      teachers.forEach((teacher) => {
        defaults[teacher.id] = existing[teacher.id] || 'present'
      })
      setTeacherMarks(defaults)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save teacher attendance')
    } finally {
      setTeacherSaving(false)
    }
  }

  const loadReport = async () => {
    setRptLoading(true)
    try {
      const params = { class_name: cls, section: sec }
      if (dateFrom) params.date_from = dateFrom
      if (dateTo)   params.date_to   = dateTo
      const { data } = await attendanceService.report(params)
      setReport(data)
    } catch {
      toast.error('Failed to load report')
    } finally {
      setRptLoading(false)
    }
  }

  const downloadReport = async () => {
    try {
      const params = { class_name: cls, section: sec }
      if (dateFrom) params.date_from = dateFrom
      if (dateTo)   params.date_to   = dateTo

      const { data } = await attendanceService.downloadReport(params)
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      const from = dateFrom || 'start'
      const to = dateTo || 'today'

      link.href = url
      link.setAttribute('download', `attendance_report_${cls}_${sec}_${from}_to_${to}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Attendance report downloaded')
    } catch {
      toast.error('Failed to download report')
    }
  }

  const STATUS_OPTS = [
    { val: 'present', label: 'P', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
    { val: 'absent',  label: 'A', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    { val: 'leave',   label: 'L', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      {isAdmin && (
        <div className="card space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Teacher Attendance</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Track daily presence of staff members</p>
            </div>
            <div>
              <label className="label">Date</label>
              <input
                className="input w-44"
                type="date"
                value={teacherDate}
                max={today()}
                onChange={(e) => setTeacherDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Month Rate</p>
              <p className="text-2xl font-bold mt-2" style={{ color: 'var(--text-primary)' }}>{teacherMonthSummary.rate}%</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>For {teacherDate.slice(0, 7)}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Present</p>
              <p className="text-2xl font-bold mt-2" style={{ color: '#10b981' }}>{teacherMonthSummary.present}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Marked this month</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Absent</p>
              <p className="text-2xl font-bold mt-2" style={{ color: '#ef4444' }}>{teacherMonthSummary.absent}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Marked this month</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Leave</p>
              <p className="text-2xl font-bold mt-2" style={{ color: '#f59e0b' }}>{teacherMonthSummary.leave}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Marked this month</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button className="btn-ghost text-xs" onClick={() => markAllTeachers('present')}>All Present</button>
            <button className="btn-ghost text-xs" onClick={() => markAllTeachers('absent')}>All Absent</button>
          </div>

          {teacherLoading ? (
            <div className="flex justify-center py-10"><Spinner size="lg" /></div>
          ) : teachers.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No teacher accounts found for this school.</p>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-12 gap-2 px-3 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="col-span-1 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>ID</span>
                <span className="col-span-5 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Teacher</span>
                <span className="col-span-6 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</span>
              </div>
              {teachers.map((teacher) => {
                const current = teacherMarks[teacher.id] || 'present'
                return (
                  <div
                    key={teacher.id}
                    className="grid grid-cols-12 gap-2 items-center px-3 py-2 rounded-xl transition-colors"
                    style={{ background: 'var(--bg-secondary)' }}
                  >
                    <span className="col-span-1 text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
                      {teacher.id}
                    </span>
                    <span className="col-span-5 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {teacher.full_name || `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email}
                    </span>
                    <div className="col-span-6 flex gap-2">
                      {STATUS_OPTS.map((opt) => (
                        <button
                          key={opt.val}
                          onClick={() => setTeacherMark(teacher.id, opt.val)}
                          className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                          style={{
                            background: current === opt.val ? opt.bg : 'transparent',
                            color: current === opt.val ? opt.color : 'var(--text-muted)',
                            border: `1px solid ${current === opt.val ? opt.color + '40' : 'var(--border)'}`,
                            transform: current === opt.val ? 'scale(1.05)' : 'scale(1)',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex justify-end pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <button className="btn-primary" onClick={handleTeacherSubmit} disabled={teacherSaving || teacherLoading}>
              {teacherSaving ? <><Spinner size="sm" /> Saving…</> : 'Save Teacher Attendance'}
            </button>
          </div>
        </div>
      )}

      {isTeacher && (
        <div className="card space-y-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>My Attendance</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Mark your own daily status</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={selfDate} max={today()} onChange={(e) => setSelfDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={selfStatus} onChange={(e) => setSelfStatus(e.target.value)}>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="leave">Leave</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Remarks</label>
              <input className="input" value={selfRemarks} onChange={(e) => setSelfRemarks(e.target.value)} placeholder="Optional note" />
            </div>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={handleSelfSubmit} disabled={selfSaving}>
              {selfSaving ? <><Spinner size="sm" /> Saving…</> : 'Save My Attendance'}
            </button>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Recent Entries</h3>
            {selfLoading ? (
              <div className="py-6 flex justify-center"><Spinner /></div>
            ) : selfHistory.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No attendance entries yet.</p>
            ) : (
              <div className="space-y-2">
                {selfHistory.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'var(--bg-secondary)' }}>
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.date}</span>
                    <StatusBadge status={item.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Student Attendance</h1>
          <p className="page-subtitle">Mark and track daily attendance for students</p>
        </div>
        {/* Tab switcher */}
        <div
          className="flex rounded-xl p-1"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          {['mark', 'report'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-1.5 text-sm font-medium rounded-lg capitalize transition-all"
              style={{
                background: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {t === 'mark' ? 'Mark Attendance' : 'View Report'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="card flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Class</label>
          <select className="select w-28" value={cls} onChange={e => setCls(e.target.value)}>
            {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Section</label>
          <select className="select w-28" value={sec} onChange={e => setSec(e.target.value)}>
            {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
          </select>
        </div>
        {tab === 'mark' && (
          <div>
            <label className="label">Date</label>
            <input
              className="input w-44"
              type="date"
              value={date}
              max={today()}
              onChange={e => setDate(e.target.value)}
            />
          </div>
        )}
        {tab === 'report' && (
          <>
            <div>
              <label className="label">From</label>
              <input className="input w-40" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">To</label>
              <input className="input w-40" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <button className="btn-primary self-end" onClick={loadReport}>Generate Report</button>
            <button className="btn-ghost self-end" onClick={downloadReport}>Download CSV</button>
          </>
        )}
      </div>

      {/* ── Mark tab ── */}
      {tab === 'mark' && (
        <div className="card">
          {/* Legend + bulk actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              {STATUS_OPTS.map(o => (
                <span key={o.val} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ color: o.color, background: o.bg }}>
                  {o.label} — {o.val}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost text-xs" onClick={() => markAll('present')}>All Present</button>
              <button className="btn-ghost text-xs" onClick={() => markAll('absent')}>All Absent</button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : students.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
              No students found for Class {cls}-{sec}
            </p>
          ) : (
            <>
              <div className="space-y-1">
                {/* Column header */}
                <div className="grid grid-cols-12 gap-2 px-3 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="col-span-1 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Roll</span>
                  <span className="col-span-5 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Name</span>
                  <span className="col-span-6 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</span>
                </div>
                {students.map((s) => {
                  const current = marks[s.id] || 'present'
                  return (
                    <div
                      key={s.id}
                      className="grid grid-cols-12 gap-2 items-center px-3 py-2 rounded-xl transition-colors"
                      style={{ background: 'var(--bg-secondary)' }}
                    >
                      <span className="col-span-1 text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
                        {s.roll_number}
                      </span>
                      <span className="col-span-5 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {s.full_name}
                      </span>
                      <div className="col-span-6 flex gap-2">
                        {STATUS_OPTS.map(o => (
                          <button
                            key={o.val}
                            onClick={() => setMark(s.id, o.val)}
                            className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                            style={{
                              background: current === o.val ? o.bg : 'transparent',
                              color:      current === o.val ? o.color : 'var(--text-muted)',
                              border:     `1px solid ${current === o.val ? o.color + '40' : 'var(--border)'}`,
                              transform:  current === o.val ? 'scale(1.05)' : 'scale(1)',
                            }}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {Object.values(marks).filter(v => v === 'present').length} present,{' '}
                  {Object.values(marks).filter(v => v === 'absent').length} absent,{' '}
                  {Object.values(marks).filter(v => v === 'leave').length} on leave
                </p>
                <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
                  {saving ? <><Spinner size="sm" /> Saving…</> : 'Save Attendance'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Report tab ── */}
      {tab === 'report' && (
        <div className="card">
          {rptLoading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : report.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
              Generate a report using the filters above
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Total Days</th>
                    <th>Present</th>
                    <th>Absent</th>
                    <th>Leave</th>
                    <th>Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map(r => (
                    <tr key={r.student_id}>
                      <td>
                        <div>
                          <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{r.student_name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.class_name}-{r.section}</p>
                        </div>
                      </td>
                      <td>{r.total_days}</td>
                      <td><span className="badge-green">{r.present}</span></td>
                      <td><span className="badge-red">{r.absent}</span></td>
                      <td><span className="badge-yellow">{r.leave}</span></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)', maxWidth: 80 }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${r.attendance_percentage}%`,
                                background: r.attendance_percentage >= 75 ? '#10b981' : '#ef4444',
                              }}
                            />
                          </div>
                          <span
                            className="text-xs font-semibold"
                            style={{ color: r.attendance_percentage >= 75 ? '#10b981' : '#ef4444' }}
                          >
                            {r.attendance_percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
