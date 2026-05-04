import React, { useState, useEffect, useCallback } from 'react'
import { subjectService } from '../services/api'
import { DataTable, Modal, FormField, Spinner, ErrorAlert } from '../components/common'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks'

const GRADES = ['9', '10', '11', '12']

export default function Subjects() {
  const { user } = useAuth()
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [delItem, setDelItem] = useState(null)
  const [filterGrade, setFilterGrade] = useState('')

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const params = filterGrade ? { class_name: filterGrade } : {}
      const { data } = await subjectService.list(params)
      setSubjects(data.results ?? data)
    } finally {
      setLoading(false)
    }
  }, [filterGrade])

  useEffect(() => { fetch() }, [fetch])

  const openCreate = () => { setEditItem(null); setModal(true) }
  const openEdit = (s) => { setEditItem(s); setModal(true) }

  const handleDelete = async () => {
    try {
      await subjectService.delete(delItem.id)
      toast.success('Subject removed')
      setDelItem(null)
      fetch()
    } catch { toast.error('Delete failed') }
  }

  const columns = [
    {
      key: 'code',
      label: 'Code',
      render: (r) => r.code || <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    { key: 'name', label: 'Subject Name' },
    {
      key: 'class_name',
      label: 'Grade',
      render: (r) => r.class_name ? `Grade ${r.class_name}` : 'All Grades',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <div className="flex gap-2">
          <button className="btn-ghost text-xs px-2 py-1" onClick={() => openEdit(r)}>Edit</button>
          <button className="text-xs px-2 py-1 rounded-lg" style={{ color: '#ef4444' }} onClick={() => setDelItem(r)}>
            Delete
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Subjects</h1>
          <p className="page-subtitle">Manage school subjects by grade</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ Add Subject</button>
      </div>

      <div className="card flex gap-3 items-end">
        <div>
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Filter by Grade</label>
          <select
            className="input mt-1"
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
          >
            <option value="">All Grades</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
        </div>
      </div>

      <DataTable columns={columns} data={subjects} loading={loading} />

      <SubjectModal
        open={modal}
        onClose={() => { setModal(false); setEditItem(null) }}
        initial={editItem}
        onSuccess={() => { setModal(false); setEditItem(null); fetch() }}
      />

      <Modal open={!!delItem} onClose={() => setDelItem(null)} title="Remove Subject">
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
          Remove <b style={{ color: 'var(--text-primary)' }}>{delItem?.name}</b>? This is permanent.
        </p>
        <div className="flex gap-3 justify-end">
          <button className="btn-ghost" onClick={() => setDelItem(null)}>Cancel</button>
          <button className="btn-danger" onClick={handleDelete}>Remove</button>
        </div>
      </Modal>
    </div>
  )
}

function SubjectModal({ open, onClose, initial, onSuccess }) {
  const def = () => ({
    name: '', code: '', class_name: '',
  })
  const [form, setForm] = useState(def())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(initial || def())
    setError('')
  }, [initial, open])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (initial) {
        await subjectService.update(initial.id, form)
        toast.success('Subject updated')
      } else {
        await subjectService.create(form)
        toast.success('Subject added')
      }
      onSuccess()
    } catch (err) {
      const d = err.response?.data
      setError(d?.detail || Object.entries(d || {}).map(([k, v]) => `${k}: ${[v].flat().join(', ')}`).join(' | ') || 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Subject' : 'Add Subject'} width="max-w-lg">
      <ErrorAlert message={error} />
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Subject Name *">
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Subject Code">
            <input className="input" placeholder="e.g. MA101" value={form.code} onChange={e => set('code', e.target.value)} />
          </FormField>
          <FormField label="Grade">
            <select className="input" value={form.class_name} onChange={e => set('class_name', e.target.value)}>
              <option value="">All Grades</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>
          </FormField>
        </div>
        <div className="flex gap-3 justify-end pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Spinner size="sm" /> : initial ? 'Save' : 'Add Subject'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
