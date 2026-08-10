import React, { useState, useEffect, useCallback } from 'react'
import { feeService, studentService } from '../services/api'
import { Modal, FormField, Spinner, ErrorAlert, FullPageSpinner } from '../components/common'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks'

const ACADEMIC_YEAR_OPTIONS = (() => {
  const startYear = new Date().getFullYear()
  return Array.from({ length: 8 }, (_, i) => {
    const y = startYear - i
    const yy = String(y + 1).slice(-2)
    return `${y}-${yy}`
  })
})()

const CLASS_OPTIONS = ['8', '9', '10', '11', '12']
const SECTION_OPTIONS = ['A', 'B', 'C', 'D']
// Common presets — quick-picks only, not an enforced list. Admin can also
// type any custom category label (e.g. "Sports Fee", "ID Card Fee") via
// the "Custom…" option, same pattern as the Teacher/Staff designation field.
const CATEGORY_OPTIONS = [
  ['tuition', 'Tuition'], ['library', 'Library'], ['transport', 'Transport'],
  ['hostel', 'Hostel'], ['exam', 'Examination'], ['other', 'Other'],
]
const FREQUENCY_OPTIONS = [
  ['one_time', 'One-Time'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'],
  ['half_yearly', 'Half-Yearly'], ['annual', 'Annual'],
]
const FREQUENCY_LABEL = Object.fromEntries(FREQUENCY_OPTIONS)
// A Librarian's fee duties are scoped to library fees only — enforced
// server-side too (apps.fees.permissions), this just keeps their UI
// limited to what they're actually allowed to do.
const isLibraryScoped = (user) => user?.role === 'staff' && user?.designation === 'Librarian'

// ── Student Picker — direct search + class/section/roll filtering ────────────
function StudentPicker({ student, onSelect }) {
  const [search, setSearch]   = useState('')
  const [klass, setKlass]     = useState('')
  const [section, setSection] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const hasQuery = !!(search.trim() || klass || section)

  useEffect(() => {
    if (student || !hasQuery) { setResults([]); return }
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const params = { page_size: 20 }
        if (search.trim()) params.search = search.trim()
        if (klass) params.class_name = klass
        if (section) params.section = section
        const { data } = await studentService.list(params)
        setResults(data.results ?? data)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search, klass, section, student, hasQuery])

  if (student) {
    return (
      <div
        className="flex items-center justify-between rounded-xl px-3 py-2"
        style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{student.full_name}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Class {student.class_name}-{student.section} · Roll {student.roll_number}
          </p>
        </div>
        <button type="button" className="btn-ghost text-xs" onClick={() => onSelect(null)}>Change</button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <input
          className="input col-span-3 sm:col-span-1"
          placeholder="Search name or roll no."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="select" value={klass} onChange={(e) => setKlass(e.target.value)}>
          <option value="">All Classes</option>
          {CLASS_OPTIONS.map(c => <option key={c} value={c}>Class {c}</option>)}
        </select>
        <select className="select" value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="">All Sections</option>
          {SECTION_OPTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
        </select>
      </div>
      {hasQuery ? (
        <div className="rounded-xl max-h-48 overflow-y-auto" style={{ border: '1px solid var(--border)' }}>
          {loading ? (
            <div className="flex justify-center py-4"><Spinner size="sm" /></div>
          ) : results.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No students found</p>
          ) : (
            results.map(s => (
              <button
                type="button"
                key={s.id}
                onClick={() => onSelect(s)}
                className="w-full text-left px-3 py-2 text-sm transition-colors"
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ color: 'var(--text-primary)' }}>{s.full_name}</span>
                <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Class {s.class_name}-{s.section} · Roll {s.roll_number}
                </span>
              </button>
            ))
          )}
        </div>
      ) : (
        <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>
          Type a name/roll number or choose a class/section to search
        </p>
      )}
    </div>
  )
}

export default function Fees() {
  const { user } = useAuth()
  const scoped = isLibraryScoped(user)
  const [tab, setTab] = useState('payments')  // 'payments' | 'tracker' | 'structures' | 'summary'

  // A Librarian only needs to record/see library-fee payments — the
  // school-wide tracker, structure editor, and collection summary are
  // outside their job, so those tabs simply aren't offered to them.
  const TABS = scoped
    ? [['payments', 'Library Fee Payments']]
    : [['payments', 'Payments'], ['tracker', 'Student Fee Tracker'], ['structures', 'Fee Structures'], ['summary', 'Summary']]

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{scoped ? 'Library Fees' : 'Fee Management'}</h1>
          <p className="page-subtitle">
            {scoped ? 'Record and track library fee payments' : 'Track payments, structures and collections'}
          </p>
        </div>
        <div className="flex rounded-xl p-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {TABS.map(([t, l]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-1.5 text-sm font-medium rounded-lg transition-all"
              style={{
                background: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {tab === 'payments'   && <PaymentsTab />}
      {!scoped && tab === 'tracker'    && <TrackerTab />}
      {!scoped && tab === 'structures' && <StructuresTab />}
      {!scoped && tab === 'summary'    && <SummaryTab />}
    </div>
  )
}

// ── Student Fee Tracker Tab ──────────────────────────────────────────────────
function TrackerTab() {
  const [query, setQuery] = useState('')
  const [className, setClassName] = useState('')
  const [status, setStatus] = useState('')
  const [year, setYear] = useState('2024-25')
  const [hasSearched, setHasSearched] = useState(false)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [schoolSummary, setSchoolSummary] = useState(null)
  const [classBreakdown, setClassBreakdown] = useState([])

  const loadReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = { academic_year: year }
      if (query.trim()) params.search = query.trim()
      if (className) params.class_name = className
      if (status) params.status = status

      const { data } = await feeService.feeReport(params)
      setRows(data.results || [])
      setSummary(data.summary || null)
      setSchoolSummary(data.school_summary || null)
      setClassBreakdown(data.class_breakdown || [])
    } catch {
      toast.error('Failed to load fee tracker')
    } finally {
      setLoading(false)
    }
  }, [query, className, status, year])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  useEffect(() => {
    setHasSearched(false)
  }, [query, className, status, year])

  const handleSearch = () => {
    setHasSearched(true)
    loadReport()
  }

  const downloadReport = async () => {
    setDownloading(true)
    try {
      const params = { academic_year: year }
      if (query.trim()) params.search = query.trim()
      if (className) params.class_name = className
      if (status) params.status = status

      const { data } = await feeService.downloadFeeReport(params)
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.setAttribute('download', `fee_report_${year}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Fee report downloaded')
    } catch {
      toast.error('Failed to download fee report')
    } finally {
      setDownloading(false)
    }
  }

  const statusColor = {
    paid: '#10b981',
    pending: '#f59e0b',
    partial: '#3b82f6',
    no_structure: '#8b5cf6',
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Student Fee Filters
          </h3>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={handleSearch}>Search</button>
            <button className="btn-primary" onClick={downloadReport} disabled={downloading}>
              {downloading ? <Spinner size="sm" /> : 'Export CSV'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <FormField label="Search Student">
            <input
              className="input"
              placeholder="Name, email, or roll number"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </FormField>

          <FormField label="Class">
            <select className="select" value={className} onChange={(e) => setClassName(e.target.value)}>
              <option value="">All Classes</option>
              {['8', '9', '10', '11', '12'].map(c => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Status">
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Status</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="pending">Pending</option>
              <option value="no_structure">No Structure</option>
            </select>
          </FormField>

          <FormField label="Academic Year">
            <select className="select" value={year} onChange={(e) => setYear(e.target.value)}>
              {ACADEMIC_YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </FormField>
        </div>
      </div>

      {loading ? <FullPageSpinner /> : (
        <>
          {summary && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Filtered View
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl p-4" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)' }}>
                    <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Required</p>
                    <p className="text-xl font-bold mt-1" style={{ color: '#3b82f6', fontFamily: 'Inter' }}>
                      ₹{Number(summary.total_required || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)' }}>
                    <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Paid</p>
                    <p className="text-xl font-bold mt-1" style={{ color: '#10b981', fontFamily: 'Inter' }}>
                      ₹{Number(summary.total_paid || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}>
                    <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Balance</p>
                    <p className="text-xl font-bold mt-1" style={{ color: '#f59e0b', fontFamily: 'Inter' }}>
                      ₹{Number(summary.total_balance || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {schoolSummary && (
                <div className="card space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    School View
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg p-3" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.35)' }}>
                      <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Students</p>
                      <p className="text-lg font-bold mt-1" style={{ color: '#6366f1' }}>{schoolSummary.students || 0}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)' }}>
                      <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Required</p>
                      <p className="text-lg font-bold mt-1" style={{ color: '#3b82f6' }}>₹{Number(schoolSummary.total_required || 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)' }}>
                      <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Collected</p>
                      <p className="text-lg font-bold mt-1" style={{ color: '#10b981' }}>₹{Number(schoolSummary.total_paid || 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}>
                      <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Outstanding</p>
                      <p className="text-lg font-bold mt-1" style={{ color: '#f59e0b' }}>₹{Number(schoolSummary.total_balance || 0).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>Paid: {schoolSummary.paid_students || 0}</span>
                    <span className="badge" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>Partial: {schoolSummary.partial_students || 0}</span>
                    <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Pending: {schoolSummary.pending_students || 0}</span>
                    <span className="badge" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>No Structure: {schoolSummary.no_structure_students || 0}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {classBreakdown.length > 0 && (
            <div className="card overflow-x-auto">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
                Class-wise School Breakdown
              </h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Students</th>
                    <th>Required</th>
                    <th>Collected</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {classBreakdown.map((row) => (
                    <tr key={row.class_name}>
                      <td style={{ color: 'var(--text-primary)' }}>Class {row.class_name}</td>
                      <td>{row.students}</td>
                      <td>₹{Number(row.total_required).toLocaleString()}</td>
                      <td style={{ color: '#10b981' }}>₹{Number(row.total_paid).toLocaleString()}</td>
                      <td style={{ color: '#f59e0b' }}>₹{Number(row.total_balance).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasSearched && (
          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Student Fee Records
              </h3>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{rows.length} records</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Roll No.</th>
                  <th>Required</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.student_id}>
                    <td>
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{r.student_name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.email}</p>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{r.class_name}-{r.section}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{r.roll_number}</td>
                    <td className="font-semibold">₹{Number(r.fee_required).toLocaleString()}</td>
                    <td style={{ color: '#10b981' }}>₹{Number(r.total_paid).toLocaleString()}</td>
                    <td style={{ color: '#f59e0b' }}>₹{Number(r.balance).toLocaleString()}</td>
                    <td>
                      <span
                        className="badge capitalize"
                        style={{
                          background: `${statusColor[r.fee_status] || '#94a3b8'}22`,
                          color: statusColor[r.fee_status] || '#94a3b8',
                        }}
                      >
                        {r.fee_status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                      No student fee records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Payments Tab ──────────────────────────────────────────────────────────────
function PaymentsTab() {
  const [payments,   setPayments]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState(false)
  const [filterStat, setFilterStat] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterStat) params.status = filterStat
      const { data } = await feeService.payments(params)
      setPayments(data.results ?? data)
    } finally { setLoading(false) }
  }, [filterStat])

  useEffect(() => { load() }, [load])

  const statusColor = { paid: '#10b981', pending: '#f59e0b', partial: '#3b82f6', waived: '#8888aa' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['', 'paid', 'pending', 'partial'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStat(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
              style={{
                background: filterStat === s ? 'var(--bg-hover)' : 'transparent',
                color: filterStat === s ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: `1px solid ${filterStat === s ? 'var(--border-hover)' : 'transparent'}`,
              }}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setModal(true)}>+ Record Payment</button>
      </div>

      {loading ? <FullPageSpinner /> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Student</th><th>Class</th><th>Amount</th><th>Status</th><th>Method</th><th>Date</th><th>Transaction ID</th></tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td>
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{p.student_name}</p>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.class_name}</td>
                  <td className="font-semibold">₹{Number(p.amount).toLocaleString()}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: `${statusColor[p.status]}22`,
                        color: statusColor[p.status],
                      }}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="capitalize" style={{ color: 'var(--text-secondary)' }}>{p.payment_method}</td>
                  <td style={{ color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: 12 }}>
                    {p.payment_date || '—'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: 11 }}>
                    {p.transaction_id || '—'}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>No payments found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <PaymentModal open={modal} onClose={() => setModal(false)} onSuccess={() => { setModal(false); load() }} />
    </div>
  )
}

// ── Payment modal ─────────────────────────────────────────────────────────────
function PaymentModal({ open, onClose, onSuccess }) {
  const { user } = useAuth()
  const scoped = isLibraryScoped(user)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [structures,  setStructures]  = useState([])
  const [form,        setForm]        = useState({
    student_id: '', fee_structure_id: '', amount: '',
    payment_method: 'cash', transaction_id: '', remarks: '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    if (!open) return
    const params = scoped ? { category: 'library' } : {}
    feeService.structures(params).then(({ data }) => setStructures(data.results ?? data))
    setSelectedStudent(null)
    setForm({ student_id:'', fee_structure_id:'', amount:'', payment_method:'cash', transaction_id:'', remarks:'' })
    setError('')
  }, [open, scoped])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const selectStudent = (s) => {
    setSelectedStudent(s)
    set('student_id', s ? String(s.id) : '')
  }

  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (!form.student_id) { setError('Please select a student'); return }
    setSaving(true)
    try {
      await feeService.pay({ ...form, student_id: +form.student_id, fee_structure_id: +form.fee_structure_id, amount: +form.amount })
      toast.success('Payment recorded!'); onSuccess()
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to record payment')
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record Payment" width="max-w-lg">
      <ErrorAlert message={error} />
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Student">
          <StudentPicker student={selectedStudent} onSelect={selectStudent} />
        </FormField>
        <FormField label="Fee Structure">
          <select className="select" required value={form.fee_structure_id} onChange={e => set('fee_structure_id', e.target.value)}>
            <option value="">Select Fee Structure</option>
            {structures.map(fs => (
              <option key={fs.id} value={fs.id}>
                Class {fs.class_name} — {fs.category} — ₹{Number(fs.amount).toLocaleString()}
                {fs.frequency && fs.frequency !== 'one_time' && fs.frequency !== 'annual' ? `/${FREQUENCY_LABEL[fs.frequency]?.toLowerCase()}` : ''} ({fs.academic_year})
              </option>
            ))}
          </select>
          {scoped && structures.length === 0 && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              No library fee structures yet — ask an admin to add one.
            </p>
          )}
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Amount (₹)">
            <input className="input" type="number" min="1" required value={form.amount} onChange={e => set('amount', e.target.value)} />
          </FormField>
          <FormField label="Payment Method">
            <select className="select" value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
              <option value="cash">Cash</option>
              <option value="online">Online</option>
              <option value="cheque">Cheque</option>
              <option value="dd">Demand Draft</option>
            </select>
          </FormField>
        </div>
        <FormField label="Transaction ID (optional)">
          <input className="input font-mono" placeholder="TXN123..." value={form.transaction_id} onChange={e => set('transaction_id', e.target.value)} />
        </FormField>
        <div className="flex gap-3 justify-end">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Spinner size="sm" /> : 'Record Payment'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Structures Tab ────────────────────────────────────────────────────────────
function StructuresTab() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const emptyForm = { class_name: '10', category: 'tuition', frequency: 'annual', amount: '', academic_year: ACADEMIC_YEAR_OPTIONS[0], due_date: '', description: '' }
  const [list,      setList]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(false)
  const [editItem,  setEditItem]  = useState(null)
  const [delItem,   setDelItem]   = useState(null)
  const [form,      setForm]      = useState(emptyForm)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const isPresetCategory = CATEGORY_OPTIONS.some(([v]) => v === form.category)

  const load = async () => {
    setLoading(true)
    try { const { data } = await feeService.structures(); setList(data.results ?? data) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const openAdd = () => { setEditItem(null); setForm(emptyForm); setError(''); setModal(true) }
  const openEdit = (fs) => {
    setEditItem(fs)
    setForm({
      class_name: fs.class_name, category: fs.category, frequency: fs.frequency || 'annual', amount: String(fs.amount),
      academic_year: fs.academic_year, due_date: fs.due_date || '', description: fs.description || '',
    })
    setError(''); setModal(true)
  }

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('')
    const payload = { ...form, amount: +form.amount, due_date: form.due_date || null }
    try {
      if (editItem) {
        await feeService.updateStructure(editItem.id, payload)
        toast.success('Fee structure updated')
      } else {
        await feeService.createStructure(payload)
        toast.success('Fee structure created')
      }
      setModal(false); load()
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 'Failed')
    } finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    if (!delItem) return
    try {
      await feeService.deleteStructure(delItem.id)
      toast.success('Fee structure deleted'); setDelItem(null); load()
    } catch {
      toast.error('Failed to delete — it may already have payments recorded against it')
    }
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <button className="btn-primary" onClick={openAdd}>+ Add Structure</button>
        </div>
      )}
      {loading ? <FullPageSpinner /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(fs => (
            <div key={fs.id} className="card-hover">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Inter', color: 'var(--text-primary)' }}>
                    ₹{Number(fs.amount).toLocaleString()}
                    {fs.frequency && fs.frequency !== 'one_time' && fs.frequency !== 'annual' && (
                      <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}> /{FREQUENCY_LABEL[fs.frequency]?.toLowerCase()}</span>
                    )}
                  </p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Class {fs.class_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{fs.academic_year}</p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className="badge-blue">{fs.category}</span>
                  <span className="badge-gray text-xs">{FREQUENCY_LABEL[fs.frequency] || 'Annual'}</span>
                </div>
              </div>
              {fs.due_date && (
                <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>Due: {fs.due_date}</p>
              )}
              {isAdmin && (
                <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <button className="btn-ghost text-xs flex-1" onClick={() => openEdit(fs)}>Edit</button>
                  <button className="btn-ghost text-xs flex-1 text-red-400" onClick={() => setDelItem(fs)}>Delete</button>
                </div>
              )}
            </div>
          ))}
          {list.length === 0 && (
            <p className="text-sm col-span-3 text-center py-12" style={{ color: 'var(--text-muted)' }}>No fee structures yet.</p>
          )}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editItem ? 'Edit Fee Structure' : 'Add Fee Structure'}>
        <ErrorAlert message={error} />
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Class">
              <select className="select" value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))}>
                {['8','9','10','11','12'].map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </FormField>
            <FormField label={form.frequency === 'monthly' || form.frequency === 'quarterly' || form.frequency === 'half_yearly' ? `Amount per ${FREQUENCY_LABEL[form.frequency].toLowerCase()} period (₹)` : 'Amount (₹)'}>
              <input className="input" type="number" min="0" required value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Category">
              <select
                className="select"
                value={isPresetCategory ? form.category : 'custom'}
                onChange={e => setForm(f => ({ ...f, category: e.target.value === 'custom' ? '' : e.target.value }))}
              >
                {CATEGORY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                <option value="custom">Custom…</option>
              </select>
              {!isPresetCategory && (
                <input className="input mt-2" placeholder="e.g. Sports Fee, ID Card Fee" required
                  value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
              )}
            </FormField>
            <FormField label="Frequency">
              <select className="select" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                {FREQUENCY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Academic Year">
              <select className="select" value={form.academic_year}
                onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))}>
                {ACADEMIC_YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Due Date (optional)">
              <input className="input" type="date" value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Description (optional)">
            <input className="input" placeholder="e.g. Winter term transport fee" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </FormField>
          <div className="flex gap-3 justify-end">
            <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Spinner size="sm" /> : (editItem ? 'Save Changes' : 'Create')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!delItem} onClose={() => setDelItem(null)} title="Delete Fee Structure" width="max-w-sm">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Delete the {delItem?.category} fee structure for Class {delItem?.class_name} ({delItem?.academic_year})?
          Existing payments against it are kept but unlinked.
        </p>
        <div className="flex gap-3 justify-end mt-5">
          <button className="btn-ghost" onClick={() => setDelItem(null)}>Cancel</button>
          <button className="btn-primary" style={{ background: '#ef4444' }} onClick={confirmDelete}>Delete</button>
        </div>
      </Modal>
    </div>
  )
}

// ── Summary Tab ───────────────────────────────────────────────────────────────
function SummaryTab() {
  const [summary, setSummary] = useState(null)
  const [year, setYear]       = useState(ACADEMIC_YEAR_OPTIONS[0])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await feeService.collectionSummary({ academic_year: year })
      setSummary(data)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [year])

  const statStyle = (color) => ({
    background: `${color}15`, border: `1px solid ${color}30`, color,
  })

  return (
    <div className="space-y-4">
      <div className="card flex gap-3 items-center">
        <label className="label mb-0">Academic Year</label>
        <select className="select w-36" value={year} onChange={e => setYear(e.target.value)}>
          {ACADEMIC_YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading ? <FullPageSpinner /> : summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Collected', value: `₹${Number(summary.total_collected).toLocaleString()}`, color: '#10b981' },
            { label: 'Paid',    value: summary.paid_count,    color: '#10b981' },
            { label: 'Pending', value: summary.pending_count, color: '#f59e0b' },
            { label: 'Partial', value: summary.partial_count, color: '#3b82f6' },
          ].map(stat => (
            <div key={stat.label} className="rounded-2xl p-5" style={statStyle(stat.color)}>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{stat.label}</p>
              <p className="text-3xl font-bold mt-2" style={{ fontFamily: 'Inter', color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
