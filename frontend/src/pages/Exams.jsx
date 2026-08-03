import React, { useState, useEffect, useCallback } from 'react'
import { examService, subjectService, resultService, studentService } from '../services/api'
import { Modal, FormField, Spinner, ErrorAlert, FullPageSpinner } from '../components/common'
import toast from 'react-hot-toast'

export default function Exams() {
  const [tab, setTab] = useState('exams')  // 'exams' | 'results' | 'card'

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Examinations</h1>
          <p className="page-subtitle">Manage exams, enter marks and view result cards</p>
        </div>
        <div className="flex rounded-xl p-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {['exams', 'results', 'card'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-1.5 text-sm font-medium rounded-lg capitalize transition-all"
              style={{
                background: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {t === 'card' ? 'Result Card' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {tab === 'exams'   && <ExamsTab />}
      {tab === 'results' && <ResultsTab />}
      {tab === 'card'    && <ResultCardTab />}
    </div>
  )
}

// ── Exams Tab ─────────────────────────────────────────────────────────────────
function ExamsTab() {
  const [exams,   setExams]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(false)
  const [form,    setForm]    = useState({ name: '', academic_year: '2024-25', start_date: '', end_date: '' })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const load = async () => {
    setLoading(true)
    try { const { data } = await examService.list(); setExams(data.results ?? data) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await examService.create(form)
      toast.success('Exam created'); setModal(false); load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create exam')
    } finally { setSaving(false) }
  }

  const del = async (id) => {
    if (!confirm('Delete this exam?')) return
    await examService.delete(id); toast.success('Exam deleted'); load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setModal(true)}>+ New Exam</button>
      </div>

      {loading ? <FullPageSpinner /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {exams.map(ex => (
            <div key={ex.id} className="card-hover">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{ex.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{ex.academic_year}</p>
                </div>
                <span className={ex.is_active ? 'badge-green' : 'badge-gray'}>
                  {ex.is_active ? 'Active' : 'Closed'}
                </span>
              </div>
              {ex.start_date && (
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  📅 {ex.start_date} → {ex.end_date}
                </p>
              )}
              <div className="flex justify-end mt-3">
                <button onClick={() => del(ex.id)} className="text-xs" style={{ color: '#ef4444' }}>Delete</button>
              </div>
            </div>
          ))}
          {exams.length === 0 && (
            <p className="text-sm col-span-3 text-center py-12" style={{ color: 'var(--text-muted)' }}>
              No exams created yet.
            </p>
          )}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Create Exam">
        <ErrorAlert message={error} />
        <form onSubmit={submit} className="space-y-4">
          <FormField label="Exam Name">
            <input className="input" placeholder="e.g. Midterm 2024" required
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </FormField>
          <FormField label="Academic Year">
            <input className="input" value={form.academic_year}
              onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start Date">
              <input className="input" type="date" value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </FormField>
            <FormField label="End Date">
              <input className="input" type="date" value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </FormField>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Spinner size="sm" /> : 'Create Exam'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ── Results Entry Tab ─────────────────────────────────────────────────────────
function ResultsTab() {
  const [exams,    setExams]    = useState([])
  const [subjects, setSubjects] = useState([])
  const [students, setStudents] = useState([])
  const [selExam,  setSelExam]  = useState('')
  const [selSubj,  setSelSubj]  = useState('')
  const [cls,      setCls]      = useState('10')
  const [marks,    setMarks]    = useState({})  // { studentId: marks }
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    examService.list().then(({ data }) => setExams(data.results ?? data))
    subjectService.list().then(({ data }) => setSubjects(data.results ?? data))
  }, [])

  useEffect(() => {
    if (!cls) return
    studentService.list({ class_name: cls, page_size: 100 })
      .then(({ data }) => setStudents(data.results ?? data))
  }, [cls])

  const handleSave = async () => {
    if (!selExam || !selSubj) return toast.error('Select exam and subject first')
    setSaving(true)
    try {
      for (const [sid, m] of Object.entries(marks)) {
        if (!m) continue
        await resultService.create({
          student: parseInt(sid), exam: parseInt(selExam),
          subject: parseInt(selSubj), marks_obtained: m, max_marks: 100,
        }).catch(() => {})  // silently skip duplicates
      }
      toast.success('Results saved successfully!')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Exam</label>
          <select className="select w-44" value={selExam} onChange={e => setSelExam(e.target.value)}>
            <option value="">Select Exam</option>
            {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Subject</label>
          <select className="select w-40" value={selSubj} onChange={e => setSelSubj(e.target.value)}>
            <option value="">Select Subject</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Class</label>
          <select className="select w-28" value={cls} onChange={e => setCls(e.target.value)}>
            {['8','9','10','11','12'].map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
        </div>
      </div>

      {students.length > 0 && (
        <div className="card space-y-2">
          <div className="grid grid-cols-12 gap-2 px-3 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="col-span-1 text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Roll</span>
            <span className="col-span-7 text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Student</span>
            <span className="col-span-4 text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Marks / 100</span>
          </div>
          {students.map(s => (
            <div key={s.id} className="grid grid-cols-12 gap-2 items-center px-3 py-1.5 rounded-xl"
              style={{ background: 'var(--bg-secondary)' }}>
              <span className="col-span-1 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{s.roll_number}</span>
              <span className="col-span-7 text-sm" style={{ color: 'var(--text-primary)' }}>{s.full_name}</span>
              <div className="col-span-4">
                <input
                  type="number" min="0" max="100"
                  className="input text-sm py-1.5"
                  placeholder="—"
                  value={marks[s.id] || ''}
                  onChange={e => setMarks(m => ({ ...m, [s.id]: e.target.value }))}
                />
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-3">
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><Spinner size="sm" /> Saving…</> : 'Save All Marks'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Result Card Tab ───────────────────────────────────────────────────────────
function ResultCardTab() {
  const [exams,    setExams]    = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [students, setStudents] = useState([])
  const [selClass, setSelClass] = useState('')
  const [selExam,  setSelExam]  = useState('')
  const [selStud,  setSelStud]  = useState('')
  const [card,     setCard]     = useState(null)
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    examService.list().then(({ data }) => setExams(data.results ?? data))
    studentService.list({ page_size: 500 }).then(({ data }) => setAllStudents(data.results ?? data))
  }, [])

  // Filter students by selected class
  useEffect(() => {
    if (!selClass) {
      setStudents([])
      setSelStud('')
      return
    }
    const filtered = allStudents.filter(s => s.class_name === selClass)
    setStudents(filtered)
    setSelStud('')  // Reset student selection when class changes
  }, [selClass, allStudents])

  const load = async () => {
    if (!selExam || !selStud) return toast.error('Select a class, student and exam')
    setLoading(true)
    try {
      const { data } = await resultService.studentCard({ student: selStud, exam: selExam })
      setCard(data)
    } catch { toast.error('No results found for this selection') }
    finally { setLoading(false) }
  }

  const gradeColor = (g) => {
    if (['A+','A'].includes(g)) return '#10b981'
    if (g === 'B') return '#3b82f6'
    if (g === 'C') return '#f59e0b'
    return '#ef4444'
  }

  // Get unique class names from all students
  const uniqueClasses = [...new Set(allStudents.map(s => s.class_name))].sort()

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Grade/Class</label>
          <select className="select w-32" value={selClass} onChange={e => setSelClass(e.target.value)}>
            <option value="">Select Grade</option>
            {uniqueClasses.map(cls => <option key={cls} value={cls}>{cls}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Student</label>
          <select className="select w-56" value={selStud} onChange={e => setSelStud(e.target.value)} disabled={!selClass}>
            <option value="">Select Student</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.full_name} — {s.section}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Exam</label>
          <select className="select w-44" value={selExam} onChange={e => setSelExam(e.target.value)}>
            <option value="">Select Exam</option>
            {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </div>
        <button className="btn-primary self-end" onClick={load} disabled={loading}>
          {loading ? <Spinner size="sm" /> : 'View Card'}
        </button>
      </div>

      {card && (
        <div className="card space-y-5 animate-slide-up">
          {/* Card header */}
          <div
            className="rounded-xl p-5 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #312e81, #1e1b4b)', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Inter' }}>Result Card</h2>
            <div className="flex flex-wrap gap-6 mt-3">
              <div>
                <p className="text-xs text-indigo-300">Student</p>
                <p className="font-semibold text-white">{card.student_name}</p>
              </div>
              <div>
                <p className="text-xs text-indigo-300">Exam</p>
                <p className="font-semibold text-white">{card.exam_name}</p>
              </div>
              <div>
                <p className="text-xs text-indigo-300">Total Marks</p>
                <p className="font-semibold text-white">{card.total_marks_obtained} / {card.total_max_marks}</p>
              </div>
              <div>
                <p className="text-xs text-indigo-300">Percentage</p>
                <p className="font-semibold text-white">{card.overall_percentage}%</p>
              </div>
              <div>
                <p className="text-xs text-indigo-300">Grade</p>
                <p className="text-2xl font-bold" style={{ color: gradeColor(card.overall_grade) }}>
                  {card.overall_grade}
                </p>
              </div>
            </div>
          </div>

          {/* Subject breakdown */}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Marks Obtained</th>
                  <th>Max Marks</th>
                  <th>Percentage</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {card.results.map(r => (
                  <tr key={r.id}>
                    <td className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.subject_name}</td>
                    <td>{r.marks_obtained}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.max_marks}</td>
                    <td>{r.percentage}%</td>
                    <td>
                      <span className="font-bold text-sm" style={{ color: gradeColor(r.grade) }}>{r.grade}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
