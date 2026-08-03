import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { studentService, userService } from '../services/api'
import { useAuth } from '../hooks'
import {
  DataTable, Modal, StatusBadge, FormField,
  Pagination, Spinner, ErrorAlert,
} from '../components/common'
import toast from 'react-hot-toast'
import { toMediaUrl } from '../utils/media'

const CLASSES  = ['8', '9', '10', '11', '12']
const SECTIONS = ['A', 'B', 'C', 'D']

export default function Students() {
  const { isAdmin, user } = useAuth()
  const [searchParams] = useSearchParams()
  const [students,   setStudents]   = useState([])
  const [count,      setCount]      = useState(0)
  const [page,       setPage]       = useState(1)
  const [loading,    setLoading]    = useState(true)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [viewTarget, setViewTarget] = useState(null)
  const [delTarget,  setDelTarget]  = useState(null)
  const [filters,    setFilters]    = useState({ class_name: '', section: '', search: searchParams.get('q') || '' })
  const [importResult, setImportResult] = useState(null)
  const [csvPassword, setCsvPassword] = useState('')
  const fileInputRef = useRef(null)

  const PAGE_SIZE = 20

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, page_size: PAGE_SIZE }
      if (filters.class_name) params.class_name = filters.class_name
      if (filters.section)    params.section    = filters.section
      if (filters.search)     params.search     = filters.search
      const { data } = await studentService.list(params)
      setStudents(data.results ?? data)
      setCount(data.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  const openCreate = () => { setEditTarget(null); setModalOpen(true) }
  const openEdit   = (s)  => { setEditTarget(s);    setModalOpen(true) }
  const closeModal = ()   => { setModalOpen(false); setEditTarget(null) }

  const handleDelete = async () => {
    try {
      await studentService.delete(delTarget.id)
      toast.success('Student removed')
      setDelTarget(null)
      fetchStudents()
    } catch {
      toast.error('Failed to delete student')
    }
  }

  const openCsvPicker = () => {
    fileInputRef.current?.click()
  }

  const handleCsvChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const { data } = await studentService.importCsv(file, csvPassword)
      setImportResult(data)
      if (data.failed_count > 0) {
        toast.success(`Imported ${data.created_count} students. ${data.failed_count} rows failed.`)
      } else {
        toast.success(`Imported ${data.created_count} students successfully`)
      }
      fetchStudents()
    } catch (err) {
      const d = err.response?.data
      const msg =
        d?.detail ||
        Object.entries(d || {}).map(([k, v]) => `${k}: ${[v].flat().join(', ')}`).join(' | ') ||
        'CSV upload failed'
      toast.error(msg)
    } finally {
      e.target.value = ''
    }
  }

  const columns = [
    {
      key: 'name', label: 'Student',
      render: (r) => (
        <div className="flex items-center gap-3">
          {r.user_detail?.profile_photo ? (
            <img
              src={toMediaUrl(r.user_detail.profile_photo)}
              alt={r.full_name}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
            >
              {r.full_name?.[0]}
            </div>
          )}
          <div>
            <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{r.full_name}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'class_name', label: 'Class' },
    { key: 'section',    label: 'Section' },
    { key: 'roll_number', label: 'Roll No.' },
    {
      key: 'parent_contact', label: 'Parent Contact',
      render: (r) => r.parent_contact || <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      key: 'actions', label: 'Actions',
      render: (r) => (
        <div className="flex gap-2">
          <button className="btn-ghost text-xs px-2 py-1" onClick={() => setViewTarget(r)}>View</button>
          {isAdmin && (
            <>
              <button className="btn-ghost text-xs px-2 py-1" onClick={() => openEdit(r)}>Edit</button>
              <button
                className="text-xs px-2 py-1 rounded-lg transition-colors"
                style={{ color: '#ef4444' }}
                onClick={() => setDelTarget(r)}
              >
                Delete
              </button>
            </>
          )}
        </div>
      ),
    },
  ].filter(Boolean)

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">{count} total students enrolled</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2 items-end">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleCsvChange}
            />
            <FormField label="Shared CSV Password">
              <input
                className="input w-44"
                type="password"
                value={csvPassword}
                onChange={(e) => setCsvPassword(e.target.value)}
                placeholder="Auto-generate"
              />
            </FormField>
            <button className="btn-ghost" onClick={openCsvPicker}>
              Upload CSV
            </button>
            <button className="btn-primary" onClick={openCreate}>
              + Add Student
            </button>
          </div>
        )}
      </div>

      {importResult && (
        <div className="card space-y-2">
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
            Import result: {importResult.created_count} created, {importResult.failed_count} failed
          </p>
          {importResult.failed_count > 0 && (
            <div className="text-xs" style={{ color: '#b91c1c' }}>
              {importResult.errors?.slice(0, 5).map((rowErr, i) => (
                <p key={i}>
                  Row {rowErr.row}: {rowErr.error}
                </p>
              ))}
              {importResult.errors?.length > 5 && (
                <p>Showing first 5 errors out of {importResult.errors.length}.</p>
              )}
            </div>
          )}
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Required CSV columns: {importResult.required_columns?.join(', ')}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Optional CSV columns: {importResult.optional_columns?.join(', ')}
          </p>
          {importResult.credentials?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: 'var(--text-muted)' }}>
                    <th className="text-left py-1 pr-3 font-medium">Student</th>
                    <th className="text-left py-1 pr-3 font-medium">Email</th>
                    <th className="text-left py-1 pr-3 font-medium">Password</th>
                    <th className="text-left py-1 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {importResult.credentials.map((item) => (
                    <tr key={item.email} style={{ color: 'var(--text-primary)' }}>
                      <td className="py-1 pr-3">{item.full_name}</td>
                      <td className="py-1 pr-3">{item.email}</td>
                      <td className="py-1 pr-3 font-mono">{item.password}</td>
                      <td className="py-1">{item.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 items-center">
        <input
          className="input w-48 text-sm"
          placeholder="Search name or roll…"
          value={filters.search}
          onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
        />
        <select
          className="select w-36 text-sm"
          value={filters.class_name}
          onChange={(e) => setFilters(f => ({ ...f, class_name: e.target.value }))}
        >
          <option value="">All Classes</option>
          {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
        </select>
        <select
          className="select w-36 text-sm"
          value={filters.section}
          onChange={(e) => setFilters(f => ({ ...f, section: e.target.value }))}
        >
          <option value="">All Sections</option>
          {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
        </select>
        {(filters.class_name || filters.section || filters.search) && (
          <button
            className="btn-ghost text-xs"
            onClick={() => setFilters({ class_name: '', section: '', search: '' })}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <DataTable columns={columns} data={students} loading={loading} />
      <Pagination
        page={page}
        totalPages={Math.ceil(count / PAGE_SIZE)}
        onPageChange={setPage}
      />

      <StudentDetailModal
        open={!!viewTarget}
        onClose={() => setViewTarget(null)}
        student={viewTarget}
      />

      {/* Create / Edit Modal */}
      <StudentModal
        open={modalOpen}
        onClose={closeModal}
        initial={editTarget}
        schoolId={user?.school}
        onSuccess={() => { closeModal(); fetchStudents() }}
      />

      {/* Delete confirm */}
      <Modal open={!!delTarget} onClose={() => setDelTarget(null)} title="Delete Student">
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
          Remove <b style={{ color: 'var(--text-primary)' }}>{delTarget?.full_name}</b> permanently?
          This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button className="btn-ghost" onClick={() => setDelTarget(null)}>Cancel</button>
          <button className="btn-danger" onClick={handleDelete}>Delete</button>
        </div>
      </Modal>
    </div>
  )
}

// ── Student Create/Edit Modal ─────────────────────────────────────────────────
function StudentModal({ open, onClose, initial, schoolId, onSuccess }) {
  const [form,    setForm]    = useState(defaultForm())
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  function defaultForm() {
    return {
      email: '', first_name: '', last_name: '', password: 'Student@123',
      class_name: '', section: '', roll_number: '', parent_contact: '', date_of_birth: '', address: '',
      profile_photo: null,
    }
  }

  useEffect(() => {
    if (initial) {
      setForm({
        first_name: initial.user_detail?.first_name || '',
        last_name: initial.user_detail?.last_name || '',
        email: initial.user_detail?.email || initial.email || '',
        class_name:    initial.class_name || '',
        section:       initial.section || '',
        roll_number:   initial.roll_number || '',
        parent_contact:initial.parent_contact || '',
        date_of_birth: initial.date_of_birth || '',
        address: initial.address || '',
        profile_photo: null,
      })
    } else {
      setForm(defaultForm())
    }
    setError('')
  }, [initial, open])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (initial) {
        const payload = new FormData()
        payload.append('first_name', form.first_name)
        payload.append('last_name', form.last_name)
        payload.append('email', form.email)
        payload.append('class_name', form.class_name)
        payload.append('section', form.section)
        payload.append('roll_number', form.roll_number)
        payload.append('parent_contact', form.parent_contact)
        payload.append('address', form.address)
        if (form.date_of_birth) payload.append('date_of_birth', form.date_of_birth)
        if (form.profile_photo) payload.append('profile_photo', form.profile_photo)

        await studentService.update(initial.id, payload)
        toast.success('Student updated')
      } else {
        if (!schoolId) {
          throw new Error('Your admin account is not linked to a school. Please contact super admin.')
        }

        // 1. Create user account
        const { data: newUser } = await userService.create({
          email: form.email,
          first_name: form.first_name,
          last_name: form.last_name,
          password: form.password,
          re_password: form.password,
          role: 'student',
          school: schoolId,
        })

        if (!newUser?.id) {
          throw new Error('Student account was created without a user id. Please try again.')
        }

        // 2. Create student profile. If this fails, the user account from step 1
        // would otherwise be left behind with no profile (broken login). Roll it
        // back so the admin can safely retry with the same email.
        try {
          await studentService.create({
            user: newUser.id,
            class_name: form.class_name,
            section: form.section,
            roll_number: form.roll_number,
            parent_contact: form.parent_contact,
            address: form.address,
            date_of_birth: form.date_of_birth || undefined,
          })
        } catch (profileError) {
          await userService.delete(newUser.id).catch(() => {})
          throw profileError
        }
        toast.success('Student added successfully')
      }
      onSuccess()
    } catch (err) {
      const d = err.response?.data
      setError(
        err.message ||
        d?.detail ||
        Object.entries(d || {}).map(([k, v]) => `${k}: ${[v].flat().join(', ')}`).join(' | ') ||
        'Something went wrong'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Student' : 'Add New Student'} width="max-w-xl">
      <ErrorAlert message={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        {!initial && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Account Details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First Name">
                <input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} required />
              </FormField>
              <FormField label="Last Name">
                <input className="input" value={form.last_name} onChange={e => set('last_name', e.target.value)} required />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Email">
                <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
              </FormField>
              <FormField label="Default Password">
                <input className="input" value={form.password} onChange={e => set('password', e.target.value)} required />
              </FormField>
            </div>
            <hr style={{ borderColor: 'var(--border)' }} />
          </>
        )}

        {initial && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Personal Details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First Name">
                <input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} required />
              </FormField>
              <FormField label="Last Name">
                <input className="input" value={form.last_name} onChange={e => set('last_name', e.target.value)} required />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Email">
                <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
              </FormField>
              <FormField label="Profile Photo">
                <input className="input" type="file" accept="image/*" onChange={e => set('profile_photo', e.target.files?.[0] || null)} />
              </FormField>
            </div>
            <hr style={{ borderColor: 'var(--border)' }} />
          </>
        )}

        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Academic Details
        </p>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Class">
            <select className="select" value={form.class_name} onChange={e => set('class_name', e.target.value)} required>
              <option value="">Select</option>
              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormField>
          <FormField label="Section">
            <select className="select" value={form.section} onChange={e => set('section', e.target.value)} required>
              <option value="">Select</option>
              {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Roll Number">
            <input className="input" value={form.roll_number} onChange={e => set('roll_number', e.target.value)} required />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Parent Contact">
            <input className="input" value={form.parent_contact} onChange={e => set('parent_contact', e.target.value)} />
          </FormField>
          <FormField label="Date of Birth">
            <input className="input" type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
          </FormField>
        </div>
        <FormField label="Address">
          <textarea className="input" rows="3" value={form.address} onChange={e => set('address', e.target.value)} />
        </FormField>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Spinner size="sm" /> : initial ? 'Save Changes' : 'Add Student'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function StudentDetailModal({ open, onClose, student }) {
  if (!student) return null

  return (
    <Modal open={open} onClose={onClose} title="Student Details" width="max-w-lg">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {student.user_detail?.profile_photo ? (
            <img
              src={toMediaUrl(student.user_detail.profile_photo)}
              alt={student.full_name}
              className="w-14 h-14 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
            >
              {student.full_name?.[0]}
            </div>
          )}
          <div>
            <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{student.full_name}</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{student.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-hover)' }}>
            <p style={{ color: 'var(--text-muted)' }}>Class</p>
            <p style={{ color: 'var(--text-primary)' }}>{student.class_name || '—'}</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-hover)' }}>
            <p style={{ color: 'var(--text-muted)' }}>Section</p>
            <p style={{ color: 'var(--text-primary)' }}>{student.section || '—'}</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-hover)' }}>
            <p style={{ color: 'var(--text-muted)' }}>Roll No.</p>
            <p style={{ color: 'var(--text-primary)' }}>{student.roll_number || '—'}</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-hover)' }}>
            <p style={{ color: 'var(--text-muted)' }}>DOB</p>
            <p style={{ color: 'var(--text-primary)' }}>{student.date_of_birth || '—'}</p>
          </div>
        </div>

        <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--bg-hover)' }}>
          <p style={{ color: 'var(--text-muted)' }}>Parent Contact</p>
          <p style={{ color: 'var(--text-primary)' }}>{student.parent_contact || '—'}</p>
        </div>

        <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--bg-hover)' }}>
          <p style={{ color: 'var(--text-muted)' }}>Address</p>
          <p style={{ color: 'var(--text-primary)' }}>{student.address || '—'}</p>
        </div>

        <div className="flex justify-end">
          <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  )
}
