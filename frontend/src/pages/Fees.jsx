import React, { useState, useEffect, useCallback } from 'react'
import { feeService, studentService } from '../services/api'
import { Modal, FormField, Spinner, ErrorAlert, FullPageSpinner } from '../components/common'
import toast from 'react-hot-toast'

const ACADEMIC_YEAR_OPTIONS = (() => {
  const startYear = new Date().getFullYear()
  return Array.from({ length: 8 }, (_, i) => {
    const y = startYear - i
    const yy = String(y + 1).slice(-2)
    return `${y}-${yy}`
  })
})()

export default function Fees() {
  const [tab, setTab] = useState('payments')  // 'payments' | 'tracker' | 'structures' | 'summary'

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fee Management</h1>
          <p className="page-subtitle">Track payments, structures and collections</p>
        </div>
        <div className="flex rounded-xl p-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {[['payments', 'Payments'], ['tracker', 'Student Fee Tracker'], ['structures', 'Fee Structures'], ['summary', 'Summary']].map(([t, l]) => (
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
      {tab === 'tracker'    && <TrackerTab />}
      {tab === 'structures' && <StructuresTab />}
      {tab === 'summary'    && <SummaryTab />}
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
                    <p className="text-xl font-bold mt-1" style={{ color: '#3b82f6', fontFamily: 'Syne' }}>
                      ₹{Number(summary.total_required || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)' }}>
                    <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Paid</p>
                    <p className="text-xl font-bold mt-1" style={{ color: '#10b981', fontFamily: 'Syne' }}>
                      ₹{Number(summary.total_paid || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}>
                    <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Balance</p>
                    <p className="text-xl font-bold mt-1" style={{ color: '#f59e0b', fontFamily: 'Syne' }}>
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
                  <td style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                    {p.payment_date || '—'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
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
  const [students,    setStudents]    = useState([])
  const [structures,  setStructures]  = useState([])
  const [form,        setForm]        = useState({
    student_id: '', fee_structure_id: '', amount: '',
    payment_method: 'cash', transaction_id: '', remarks: '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    if (!open) return
    studentService.list({ page_size: 200 }).then(({ data }) => setStudents(data.results ?? data))
    feeService.structures().then(({ data }) => setStructures(data.results ?? data))
    setForm({ student_id:'', fee_structure_id:'', amount:'', payment_method:'cash', transaction_id:'', remarks:'' })
    setError('')
  }, [open])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('')
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
          <select className="select" required value={form.student_id} onChange={e => set('student_id', e.target.value)}>
            <option value="">Select Student</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.full_name} — Class {s.class_name}</option>)}
          </select>
        </FormField>
        <FormField label="Fee Structure">
          <select className="select" required value={form.fee_structure_id} onChange={e => set('fee_structure_id', e.target.value)}>
            <option value="">Select Fee Structure</option>
            {structures.map(fs => (
              <option key={fs.id} value={fs.id}>
                Class {fs.class_name} — ₹{Number(fs.amount).toLocaleString()} ({fs.academic_year})
              </option>
            ))}
          </select>
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
  const [list,    setList]    = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(false)
  const [form,    setForm]    = useState({ class_name: '10', amount: '', academic_year: ACADEMIC_YEAR_OPTIONS[0], description: '' })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const load = async () => {
    setLoading(true)
    try { const { data } = await feeService.structures(); setList(data.results ?? data) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await feeService.createStructure({ ...form, amount: +form.amount })
      toast.success('Fee structure created'); setModal(false); load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setModal(true)}>+ Add Structure</button>
      </div>
      {loading ? <FullPageSpinner /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(fs => (
            <div key={fs.id} className="card-hover">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Syne', color: 'var(--text-primary)' }}>
                    ₹{Number(fs.amount).toLocaleString()}
                  </p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Class {fs.class_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{fs.academic_year}</p>
                </div>
                <span className="badge-blue">Annual</span>
              </div>
              {fs.due_date && (
                <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>Due: {fs.due_date}</p>
              )}
            </div>
          ))}
          {list.length === 0 && (
            <p className="text-sm col-span-3 text-center py-12" style={{ color: 'var(--text-muted)' }}>No fee structures yet.</p>
          )}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Add Fee Structure">
        <ErrorAlert message={error} />
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Class">
              <select className="select" value={form.class_name} onChange={e => setForm(f => ({ ...f, class_name: e.target.value }))}>
                {['8','9','10','11','12'].map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </FormField>
            <FormField label="Amount (₹)">
              <input className="input" type="number" min="0" required value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Academic Year">
            <select className="select" value={form.academic_year}
              onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))}>
              {ACADEMIC_YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </FormField>
          <div className="flex gap-3 justify-end">
            <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Spinner size="sm" /> : 'Create'}
            </button>
          </div>
        </form>
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
              <p className="text-3xl font-bold mt-2" style={{ fontFamily: 'Syne', color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
