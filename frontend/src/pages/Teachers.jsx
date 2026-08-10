import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { teacherService, userService } from '../services/api'
import { DataTable, Modal, FormField, Spinner, ErrorAlert, Pagination } from '../components/common'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks'
import { toMediaUrl } from '../utils/media'

const DESIGNATIONS = [
  'Teacher', 'Librarian', 'Accountant', 'Lab Assistant',
  'Administrative Staff', 'Principal', 'Vice Principal', 'Clerk', 'Support Staff',
]

export default function Teachers() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [teachers,  setTeachers]  = useState([])
  const [count,     setCount]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(false)
  const [editItem,  setEditItem]  = useState(null)
  const [prefillUser, setPrefillUser] = useState(null)
  const [delItem,   setDelItem]   = useState(null)
  const [search,    setSearch]    = useState(searchParams.get('q') || '')
  const PAGE_SIZE = 20

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const [teacherRes, userRes] = await Promise.all([
        teacherService.list({ page, search }),
        userService.list({ page, search, role: 'teacher' }),
      ])

      const teacherData = teacherRes.data.results ?? teacherRes.data ?? []
      const teacherUsers = userRes.data.results ?? userRes.data ?? []
      const profileUserIds = new Set(teacherData.map((t) => t.user))
      const usersWithoutProfile = teacherUsers
        .filter((u) => !profileUserIds.has(u.id))
        .map((u) => ({
          id: `user-${u.id}`,
          user: u.id,
          full_name: u.full_name,
          email: u.email,
          subjects_detail: [],
          designation: '',
          qualification: '',
          experience_years: null,
          is_profile_missing: true,
        }))

      const merged = [...teacherData, ...usersWithoutProfile]
      setTeachers(merged)
      setCount(teacherRes.data.count ?? merged.length)
    } catch (err) {
      setTeachers([])
      setCount(0)
      toast.error(err?.response?.data?.detail || 'Failed to load teachers')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { fetch() }, [fetch])

  const openCreate = () => {
    setEditItem(null)
    setPrefillUser(null)
    setModal(true)
  }
  const openEdit = (t) => {
    if (t.is_profile_missing) {
      setEditItem(null)
      setPrefillUser({ id: t.user, full_name: t.full_name, email: t.email })
    } else {
      setEditItem(t)
      setPrefillUser(null)
    }
    setModal(true)
  }

  const handleDelete = async () => {
    try {
      if (delItem.is_profile_missing) {
        await userService.delete(delItem.user)
        toast.success('Teacher user removed')
      } else {
        await teacherService.delete(delItem.id)
        toast.success('Teacher removed')
      }
      setDelItem(null)
      fetch()
    } catch { toast.error('Delete failed') }
  }

  const columns = [
    {
      key: 'name', label: 'Teacher',
      render: (r) => (
        <div className="flex items-center gap-3">
          {r.user_detail?.profile_photo ? (
            <img
              src={toMediaUrl(r.user_detail.profile_photo)}
              alt={r.full_name}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
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
    {
      key: 'designation', label: 'Designation',
      render: (r) => r.designation || <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      key: 'subjects',
      label: 'Subjects',
      render: (r) => {
        if (!r.subjects_detail || r.subjects_detail.length === 0) {
          return <span style={{ color: 'var(--text-muted)' }}>—</span>
        }
        return (
          <div className="flex flex-wrap gap-1">
            {r.subjects_detail.map(s => (
              <span key={s.id} className="inline-block px-2 py-1 rounded text-xs" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                {s.code || s.name}
              </span>
            ))}
          </div>
        )
      }
    },
    { key: 'qualification',    label: 'Qualification',
      render: (r) => r.qualification || <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'experience_years', label: 'Experience',
      render: (r) => (
        r.experience_years == null
          ? <span style={{ color: 'var(--text-muted)' }}>—</span>
          : `${r.experience_years} yr${r.experience_years !== 1 ? 's' : ''}`
      ) },
    { key: 'basic_salary', label: 'Basic Salary',
      render: (r) => (
        r.basic_salary == null
          ? <span style={{ color: 'var(--text-muted)' }}>—</span>
          : `₹${Number(r.basic_salary).toLocaleString()}`
      ) },
    {
      key: 'actions', label: 'Actions',
      render: (r) => (
        <div className="flex gap-2">
          <button className="btn-ghost text-xs px-2 py-1" onClick={() => openEdit(r)}>
            {r.is_profile_missing ? 'Complete Profile' : 'Edit'}
          </button>
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
          <h1 className="page-title">Teachers</h1>
          <p className="page-subtitle">{count} staff members</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ Add Teacher</button>
      </div>

      <div className="card flex gap-3">
        <input
          className="input w-56 text-sm"
          placeholder="Search by name or subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataTable columns={columns} data={teachers} loading={loading} />
      <Pagination page={page} totalPages={Math.ceil(count / PAGE_SIZE)} onPageChange={setPage} />

      <TeacherModal
        open={modal}
        onClose={() => { setModal(false); setEditItem(null); setPrefillUser(null) }}
        initial={editItem}
        prefillUser={prefillUser}
        schoolId={user?.school}
        onSuccess={() => { setModal(false); setEditItem(null); setPrefillUser(null); fetch() }}
      />

      <Modal open={!!delItem} onClose={() => setDelItem(null)} title="Remove Teacher">
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
          Remove <b style={{ color: 'var(--text-primary)' }}>{delItem?.full_name}</b>? This is permanent.
        </p>
        <div className="flex gap-3 justify-end">
          <button className="btn-ghost" onClick={() => setDelItem(null)}>Cancel</button>
          <button className="btn-danger" onClick={handleDelete}>Remove</button>
        </div>
      </Modal>
    </div>
  )
}

function TeacherModal({ open, onClose, initial, prefillUser, schoolId, onSuccess }) {
  const def = () => ({
    email: '', first_name: '', last_name: '', password: 'Teacher@123',
    subjects: [], designation: 'Teacher', qualification: '', experience_years: 0, basic_salary: 0,
    profile_photo: null,
  })
  const [form,     setForm]     = useState(def())
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [subjects, setSubjects] = useState([])
  const [fetchingSubjects, setFetchingSubjects] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(initial ? {
      first_name: initial.user_detail?.first_name || '',
      last_name: initial.user_detail?.last_name || '',
      email: initial.user_detail?.email || initial.email || '',
      subjects:         initial.subjects          || [],
      designation:      initial.designation       || 'Teacher',
      qualification:    initial.qualification     || '',
      experience_years: initial.experience_years  || 0,
      basic_salary:     initial.basic_salary      || 0,
      profile_photo: null,
    } : def())
    setError('')
    
    // Fetch subjects for this school
    const fetchSubjects = async () => {
      setFetchingSubjects(true)
      try {
        const { data } = await teacherService.subjects()
        setSubjects(data)
      } catch (e) {
        console.error('Failed to fetch subjects', e)
      } finally {
        setFetchingSubjects(false)
      }
    }
    fetchSubjects()
  }, [initial, open])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleSubject = (subjectId) => {
    setForm(f => {
      const current = f.subjects || []
      if (current.includes(subjectId)) {
        return { ...f, subjects: current.filter(id => id !== subjectId) }
      } else {
        return { ...f, subjects: [...current, subjectId] }
      }
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    // A "Teacher" designation gets the full teacher role (attendance, exams,
    // application review); every other designation (Librarian, Clerk, ...)
    // gets the more limited "staff" role instead.
    const role = form.designation === 'Teacher' ? 'teacher' : 'staff'
    try {
      if (initial) {
        const payload = new FormData()
        payload.append('first_name', form.first_name)
        payload.append('last_name', form.last_name)
        payload.append('email', form.email)
        payload.append('designation', form.designation)
        payload.append('qualification', form.qualification)
        payload.append('experience_years', String(form.experience_years ?? 0))
        payload.append('basic_salary', String(form.basic_salary ?? 0))
        form.subjects.forEach((id) => payload.append('subjects', String(id)))
        if (form.profile_photo) payload.append('profile_photo', form.profile_photo)

        await teacherService.update(initial.id, payload)
        // Keep portal access in sync if the designation moved between
        // "Teacher" and a staff role (e.g. promoted, or reassigned).
        await userService.update(initial.user, { role })
        toast.success('Teacher updated')
      } else {
        let userId = prefillUser?.id
        if (!userId) {
          const { data: u } = await userService.create({
            email: form.email, first_name: form.first_name, last_name: form.last_name,
            password: form.password, re_password: form.password, role,
            school: schoolId,
          })
          userId = u.id
        } else {
          await userService.update(userId, { role })
        }
        await teacherService.create({
          user: userId, subjects: form.subjects, designation: form.designation,
          qualification: form.qualification, experience_years: form.experience_years,
          basic_salary: form.basic_salary,
        })
        toast.success(prefillUser ? 'Teacher profile completed' : 'Teacher added')
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
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Teacher' : prefillUser ? 'Complete Teacher Profile' : 'Add Teacher'} width="max-w-lg">
      <ErrorAlert message={error} />
      <form onSubmit={submit} className="space-y-4">
        {!initial && !prefillUser && (
          <>
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
              <FormField label="Password">
                <input className="input" value={form.password} onChange={e => set('password', e.target.value)} required />
              </FormField>
            </div>
            <hr style={{ borderColor: 'var(--border)' }} />
          </>
        )}

        {!initial && !!prefillUser && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid var(--border)', background: 'var(--bg-tertiary)' }}>
            Creating profile for <b>{prefillUser.full_name}</b> ({prefillUser.email})
          </div>
        )}

        {initial && (
          <>
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
        
        <FormField label="Designation">
          <select
            className="select"
            value={DESIGNATIONS.includes(form.designation) ? form.designation : 'Other'}
            onChange={e => set('designation', e.target.value === 'Other' ? '' : e.target.value)}
          >
            {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
            <option value="Other">Other</option>
          </select>
          {!DESIGNATIONS.includes(form.designation) && (
            <input
              className="input mt-2"
              placeholder="Enter designation (e.g. Peon, Receptionist)"
              value={form.designation}
              onChange={e => set('designation', e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField label="Subjects (Select one or more)">
          <div className="space-y-2 p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
            {fetchingSubjects ? (
              <p style={{ color: 'var(--text-muted)' }} className="text-sm">Loading subjects...</p>
            ) : subjects.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }} className="text-sm">No subjects available. Create subjects first.</p>
            ) : (
              subjects.map(s => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.subjects.includes(s.id)}
                    onChange={() => toggleSubject(s.id)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{s.code ? `${s.code} - ` : ''}{s.name}</span>
                  {s.class_name && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Grade {s.class_name}</span>}
                </label>
              ))
            )}
          </div>
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Qualification">
            <input className="input" placeholder="e.g. M.Sc. Math" value={form.qualification} onChange={e => set('qualification', e.target.value)} />
          </FormField>
          <FormField label="Experience (years)">
            <input className="input" type="number" min="0" value={form.experience_years} onChange={e => set('experience_years', +e.target.value)} />
          </FormField>
        </div>
        <FormField label="Basic Salary (₹ / month)">
          <input className="input" type="number" min="0" step="0.01" value={form.basic_salary} onChange={e => set('basic_salary', +e.target.value)} />
        </FormField>
        <div className="flex gap-3 justify-end pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Spinner size="sm" /> : initial ? 'Save' : 'Add Teacher'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
