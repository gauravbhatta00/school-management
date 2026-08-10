import React, { useState, useEffect, useCallback } from 'react'
import { payrollService, teacherService } from '../services/api'
import { Modal, FormField, Spinner, ErrorAlert, FullPageSpinner } from '../components/common'
import toast from 'react-hot-toast'

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const DESIGNATIONS = [
  'Teacher', 'Librarian', 'Accountant', 'Lab Assistant',
  'Administrative Staff', 'Principal', 'Vice Principal', 'Clerk', 'Support Staff',
]

export default function Payroll() {
  const [tab, setTab] = useState('payments')  // 'payments' | 'summary'

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff Payroll</h1>
          <p className="page-subtitle">Record and track teacher/staff salary payments</p>
        </div>
        <div className="flex rounded-xl p-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {[['payments', 'Salary Payments'], ['summary', 'Summary']].map(([t, l]) => (
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

      {tab === 'payments' && <PaymentsTab />}
      {tab === 'summary'  && <SummaryTab />}
    </div>
  )
}

// ── Teacher/Staff Picker — direct search + designation filtering ─────────────
function TeacherPicker({ teacher, onSelect }) {
  const [search, setSearch]         = useState('')
  const [designation, setDesignation] = useState('')
  const [results, setResults]       = useState([])
  const [loading, setLoading]       = useState(false)

  const hasQuery = !!(search.trim() || designation)

  useEffect(() => {
    if (teacher || !hasQuery) { setResults([]); return }
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const params = { page_size: 20 }
        if (search.trim()) params.search = search.trim()
        if (designation) params.designation = designation
        const { data } = await teacherService.list(params)
        setResults(data.results ?? data)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search, designation, teacher, hasQuery])

  if (teacher) {
    return (
      <div
        className="flex items-center justify-between rounded-xl px-3 py-2"
        style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{teacher.full_name}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {teacher.designation || 'Teacher/Staff'} · ₹{Number(teacher.basic_salary || 0).toLocaleString()}/mo
          </p>
        </div>
        <button type="button" className="btn-ghost text-xs" onClick={() => onSelect(null)}>Change</button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          className="input"
          placeholder="Search teacher/staff by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="select" value={designation} onChange={(e) => setDesignation(e.target.value)}>
          <option value="">All Designations</option>
          {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      {hasQuery ? (
        <div className="rounded-xl max-h-48 overflow-y-auto" style={{ border: '1px solid var(--border)' }}>
          {loading ? (
            <div className="flex justify-center py-4"><Spinner size="sm" /></div>
          ) : results.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No teachers/staff found</p>
          ) : (
            results.map(t => (
              <button
                type="button"
                key={t.id}
                onClick={() => onSelect(t)}
                className="w-full text-left px-3 py-2 text-sm transition-colors"
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ color: 'var(--text-primary)' }}>{t.full_name}</span>
                <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t.designation || '—'} · ₹{Number(t.basic_salary || 0).toLocaleString()}/mo
                </span>
              </button>
            ))
          )}
        </div>
      ) : (
        <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>
          Type a name or choose a designation to search
        </p>
      )}
    </div>
  )
}

// ── Salary Payments Tab ────────────────────────────────────────────────────────
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
      const { data } = await payrollService.payments(params)
      setPayments(data.results ?? data)
    } finally { setLoading(false) }
  }, [filterStat])

  useEffect(() => { load() }, [load])

  const statusColor = { paid: '#10b981', pending: '#f59e0b', partial: '#3b82f6', hold: '#8888aa' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['', 'paid', 'pending', 'partial', 'hold'].map(s => (
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
        <button className="btn-primary" onClick={() => setModal(true)}>+ Record Salary Payment</button>
      </div>

      {loading ? <FullPageSpinner /> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Teacher/Staff</th><th>Month</th><th>Amount</th><th>Status</th><th>Method</th><th>Date</th><th>Transaction ID</th></tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td>
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{p.teacher_name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.designation || '—'}</p>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.salary_month}</td>
                  <td className="font-semibold">₹{Number(p.amount).toLocaleString()}</td>
                  <td>
                    <span
                      className="badge capitalize"
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
                <tr><td colSpan={7} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>No salary payments found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <SalaryModal open={modal} onClose={() => setModal(false)} onSuccess={() => { setModal(false); load() }} />
    </div>
  )
}

// ── Record Salary modal ────────────────────────────────────────────────────────
function SalaryModal({ open, onClose, onSuccess }) {
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [form, setForm] = useState({
    teacher_id: '', salary_month: currentMonth(), amount: '',
    payment_method: 'cash', transaction_id: '', remarks: '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    if (!open) return
    setSelectedTeacher(null)
    setForm({ teacher_id: '', salary_month: currentMonth(), amount: '', payment_method: 'cash', transaction_id: '', remarks: '' })
    setError('')
  }, [open])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const selectTeacher = (t) => {
    setSelectedTeacher(t)
    set('teacher_id', t ? String(t.id) : '')
    if (t?.basic_salary && !form.amount) set('amount', String(t.basic_salary))
  }

  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (!form.teacher_id) { setError('Please select a teacher/staff member'); return }
    setSaving(true)
    try {
      await payrollService.pay({ ...form, teacher_id: +form.teacher_id, amount: +form.amount })
      toast.success('Salary payment recorded!'); onSuccess()
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to record salary payment')
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record Salary Payment" width="max-w-lg">
      <ErrorAlert message={error} />
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Teacher / Staff">
          <TeacherPicker teacher={selectedTeacher} onSelect={selectTeacher} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Salary Month">
            <input className="input" type="month" required value={form.salary_month} onChange={e => set('salary_month', e.target.value)} />
          </FormField>
          <FormField label="Amount (₹)">
            <input className="input" type="number" min="1" required value={form.amount} onChange={e => set('amount', e.target.value)} />
          </FormField>
        </div>
        <FormField label="Payment Method">
          <select className="select" value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
            <option value="cash">Cash</option>
            <option value="online">Online</option>
            <option value="cheque">Cheque</option>
            <option value="dd">Demand Draft</option>
          </select>
        </FormField>
        <FormField label="Transaction ID (optional)">
          <input className="input font-mono" placeholder="TXN123..." value={form.transaction_id} onChange={e => set('transaction_id', e.target.value)} />
        </FormField>
        <FormField label="Remarks (optional)">
          <input className="input" value={form.remarks} onChange={e => set('remarks', e.target.value)} />
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

// ── Summary Tab ───────────────────────────────────────────────────────────────
function SummaryTab() {
  const [summary, setSummary] = useState(null)
  const [month, setMonth]     = useState(currentMonth())
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await payrollService.payrollSummary({ salary_month: month })
      setSummary(data)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [month])

  const statStyle = (color) => ({
    background: `${color}15`, border: `1px solid ${color}30`, color,
  })

  return (
    <div className="space-y-4">
      <div className="card flex gap-3 items-center">
        <label className="label mb-0">Salary Month</label>
        <input className="input w-40" type="month" value={month} onChange={e => setMonth(e.target.value)} />
      </div>

      {loading ? <FullPageSpinner /> : summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Payroll',  value: `₹${Number(summary.total_payroll).toLocaleString()}`, color: '#6366f1' },
              { label: 'Disbursed',      value: `₹${Number(summary.total_disbursed).toLocaleString()}`, color: '#10b981' },
              { label: 'Staff Members',  value: summary.staff_count, color: '#3b82f6' },
              { label: 'Pending',        value: summary.pending_count, color: '#f59e0b' },
            ].map(stat => (
              <div key={stat.label} className="rounded-2xl p-5" style={statStyle(stat.color)}>
                <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{stat.label}</p>
                <p className="text-3xl font-bold mt-2" style={{ fontFamily: 'Inter', color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>Paid: {summary.paid_count}</span>
            <span className="badge" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>Partial: {summary.partial_count}</span>
            <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Pending: {summary.pending_count}</span>
            <span className="badge" style={{ background: 'rgba(136,136,170,0.15)', color: '#8888aa' }}>On Hold: {summary.hold_count}</span>
          </div>
        </>
      )}
    </div>
  )
}
