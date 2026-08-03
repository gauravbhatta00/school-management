import React, { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { backupService } from '../services/api'
import { Spinner, ErrorAlert, Modal } from '../components/common'
import { useAuth } from '../hooks'

const isDesktop = () => Boolean(window.desktopApp?.isElectron)

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = -1
  do {
    value /= 1024
    unit += 1
  } while (value >= 1024 && unit < units.length - 1)
  return `${value.toFixed(1)} ${units[unit]}`
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

/** Masks the OS username segment of a local path for screenshot safety —
 * this is a display courtesy, not a real security boundary (an admin can
 * already see their own machine's paths; the point is not leaking it if
 * they share a screenshot). */
function redactPath(fullPath) {
  if (!fullPath) return '—'
  return fullPath.replace(/([\\/]Users[\\/])([^\\/]+)/i, '$1***')
}

// ── Section shell ─────────────────────────────────────────────────────────────
function SettingsCard({ title, subtitle, children, actions }) {
  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm font-medium mt-0.5 break-all" style={{ color: 'var(--text-primary)' }}>{value ?? '—'}</p>
    </div>
  )
}

// ── Application info ─────────────────────────────────────────────────────────
function ApplicationInfoCard({ diagnostics, electronInfo }) {
  return (
    <SettingsCard title="Application" subtitle="Version and environment information">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Field label="Application Version" value={electronInfo?.appVersion || diagnostics?.application_version} />
        <Field label="Electron Version" value={electronInfo?.electronVersion || (isDesktop() ? undefined : 'Browser mode')} />
        <Field label="Platform" value={electronInfo?.osVersion || diagnostics?.os_version} />
        <Field label="Django Version" value={diagnostics?.django_version} />
        <Field label="Python Version" value={diagnostics?.python_version} />
        <Field label="Data Directory" value={redactPath(diagnostics?.data_directory)} />
      </div>
    </SettingsCard>
  )
}

// ── Diagnostics / integrity ──────────────────────────────────────────────────
function DiagnosticsCard({ diagnostics, electronInfo, onRefresh }) {
  const [checking, setChecking] = useState(false)
  const [integrity, setIntegrity] = useState(null)
  const [exporting, setExporting] = useState(false)

  const runIntegrityCheck = async () => {
    setChecking(true)
    try {
      const { data } = await backupService.integrityCheck()
      setIntegrity(data)
      if (data.opens && data.integrity_ok && data.missing_tables.length === 0) {
        toast.success('Database integrity check passed')
      } else {
        toast.error('Database integrity check found problems')
      }
    } catch {
      toast.error('Could not run the integrity check')
    } finally {
      setChecking(false)
    }
  }

  const exportReport = async () => {
    setExporting(true)
    try {
      const report = {
        ...diagnostics,
        electron: electronInfo,
        exported_at: new Date().toISOString(),
      }
      const content = JSON.stringify(report, null, 2)

      if (isDesktop()) {
        const result = await window.desktopApp.diagnostics.export(content)
        if (result?.ok) toast.success(`Diagnostic report saved to ${result.path}`)
        else if (!result?.canceled) toast.error(result?.error || 'Could not save the diagnostic report')
      } else {
        const blob = new Blob([content], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `diagnostic-report-${new Date().toISOString().slice(0, 10)}.json`
        link.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setExporting(false)
    }
  }

  const openLogsFolder = async () => {
    if (!isDesktop()) {
      toast.error('Opening the logs folder requires the desktop application')
      return
    }
    const result = await window.desktopApp.logs.openFolder()
    if (!result?.ok) toast.error(result?.error || 'Could not open the logs folder')
  }

  return (
    <SettingsCard
      title="Diagnostics"
      subtitle="Database integrity, logs, and a shareable diagnostic report for support"
      actions={
        <button className="btn-ghost text-xs px-3 py-1.5" onClick={onRefresh}>Refresh</button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Field label="Database Size" value={formatBytes(diagnostics?.database_size_bytes)} />
        <Field label="Media Size" value={formatBytes(diagnostics?.media_directory_size_bytes)} />
        <Field label="Backups" value={diagnostics?.backup_count} />
        <Field label="Free Disk Space" value={formatBytes(diagnostics?.disk?.free_bytes)} />
      </div>

      {integrity && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: integrity.integrity_ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${integrity.integrity_ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            color: integrity.integrity_ok ? '#10b981' : '#ef4444',
          }}
        >
          {integrity.integrity_ok && integrity.missing_tables.length === 0
            ? 'Database integrity check passed.'
            : `Database integrity check failed: ${integrity.errors.join('; ')}`}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button className="btn-secondary text-xs px-3 py-2" onClick={runIntegrityCheck} disabled={checking}>
          {checking ? <Spinner size="sm" /> : 'Run Integrity Check'}
        </button>
        <button className="btn-secondary text-xs px-3 py-2" onClick={exportReport} disabled={exporting}>
          {exporting ? <Spinner size="sm" /> : 'Export Diagnostic Report'}
        </button>
        <button className="btn-ghost text-xs px-3 py-2" onClick={openLogsFolder}>Open Logs Folder</button>
      </div>
    </SettingsCard>
  )
}

// ── Backup list + create + retention ─────────────────────────────────────────
function BackupsCard({ backups, config, onRefresh, onRestore }) {
  const [creating, setCreating] = useState(false)
  const [retentionDraft, setRetentionDraft] = useState(config)

  useEffect(() => setRetentionDraft(config), [config])

  const createBackup = async () => {
    setCreating(true)
    try {
      const { data } = await backupService.create('manual')
      toast.success(`Backup created: ${data.filename}`)
      onRefresh()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Backup failed')
    } finally {
      setCreating(false)
    }
  }

  const openBackupFolder = async () => {
    if (!isDesktop()) {
      toast.error('Opening the backup folder requires the desktop application')
      return
    }
    const result = await window.desktopApp.backup.openFolder()
    if (!result?.ok) toast.error(result?.error || 'Could not open the backup folder')
  }

  const copyToExternal = async (filename) => {
    if (!isDesktop()) {
      toast.error('Copying backups requires the desktop application')
      return
    }
    const destination = await window.desktopApp.backup.chooseDestination()
    if (!destination) return
    const result = await window.desktopApp.backup.copyTo(filename, destination)
    if (result?.ok) toast.success(`Copied to ${result.path}`)
    else toast.error(result?.error || 'Copy failed')
  }

  const saveRetention = async () => {
    try {
      await backupService.updateConfig(retentionDraft)
      toast.success('Backup retention updated')
      onRefresh()
    } catch {
      toast.error('Could not update backup retention')
    }
  }

  const latest = backups.find((b) => b.valid && (b.kind === 'manual' || b.kind === 'automatic'))

  return (
    <SettingsCard
      title="Backup and Restore"
      subtitle="Manual and automatic local backups of the database and uploaded media"
      actions={
        <div className="flex gap-2">
          <button className="btn-ghost text-xs px-3 py-1.5" onClick={openBackupFolder}>Open Backup Folder</button>
          <button className="btn-primary text-xs px-3 py-1.5" onClick={createBackup} disabled={creating}>
            {creating ? <Spinner size="sm" /> : 'Create Backup'}
          </button>
        </div>
      }
    >
      <Field label="Last Successful Backup" value={latest ? `${formatDate(latest.created_at)} (${latest.kind})` : 'None yet'} />

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Type</th>
              <th>Created</th>
              <th>Size</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {backups.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  No backups yet
                </td>
              </tr>
            ) : (
              backups.map((b) => (
                <tr key={b.filename}>
                  <td className="text-xs">{b.filename}</td>
                  <td className="text-xs capitalize">{b.kind}</td>
                  <td className="text-xs">{formatDate(b.created_at)}</td>
                  <td className="text-xs">{formatBytes(b.size_bytes)}</td>
                  <td className="text-xs">
                    {b.valid ? (
                      <span className="badge-green">valid</span>
                    ) : (
                      <span className="badge-red">unreadable</span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        className="btn-ghost text-xs px-2 py-1"
                        disabled={!b.valid}
                        onClick={() => onRestore(b)}
                      >
                        Restore
                      </button>
                      <button className="btn-ghost text-xs px-2 py-1" onClick={() => copyToExternal(b.filename)}>
                        Copy to…
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Backup Retention</p>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Manual backups to keep
            <input
              type="number"
              min={1}
              className="input mt-1 w-28"
              value={retentionDraft?.backup_retention_manual ?? ''}
              onChange={(e) => setRetentionDraft((d) => ({ ...d, backup_retention_manual: Number(e.target.value) }))}
            />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Automatic backups to keep
            <input
              type="number"
              min={1}
              className="input mt-1 w-28"
              value={retentionDraft?.backup_retention_automatic ?? ''}
              onChange={(e) => setRetentionDraft((d) => ({ ...d, backup_retention_automatic: Number(e.target.value) }))}
            />
          </label>
          <button className="btn-secondary text-xs px-3 py-2" onClick={saveRetention}>Save</button>
        </div>
      </div>
    </SettingsCard>
  )
}

// ── Restore flow ──────────────────────────────────────────────────────────────
function RestoreModal({ backup, onClose, onDone }) {
  const [step, setStep] = useState('validating') // validating | invalid | confirm | restoring | done
  const [report, setReport] = useState(null)
  const [result, setResult] = useState(null)
  const [chosenPath] = useState(backup?.path || null)

  const validate = useCallback(async (path) => {
    setStep('validating')
    try {
      const { data } = await backupService.validate(path)
      setReport(data)
      setStep(data.valid ? 'confirm' : 'invalid')
    } catch (err) {
      setReport({ valid: false, errors: [err.response?.data?.detail || 'Validation request failed'] })
      setStep('invalid')
    }
  }, [])

  useEffect(() => {
    if (chosenPath) validate(chosenPath)
  }, [chosenPath, validate])

  const executeRestore = async () => {
    setStep('restoring')
    try {
      // 1. Durable safety net: a real, validated backup of current data.
      await backupService.create('pre_restore_safety')
      // 2. Extract + re-validate the chosen backup into the known staging dir.
      await backupService.stage(chosenPath)
      // 3. Only Electron can safely stop the backend, swap files, and restart it.
      const finalizeResult = await window.desktopApp.restore.finalize()
      setResult(finalizeResult)
      setStep('done')
      if (finalizeResult.success) toast.success('Restore completed successfully')
      else toast.error(finalizeResult.message)
    } catch (err) {
      setResult({ success: false, rolledBack: false, message: err.response?.data?.detail || err.message })
      setStep('done')
      toast.error('Restore failed')
    }
  }

  return (
    <Modal open onClose={step === 'restoring' ? () => {} : onClose} title="Restore Backup" width="max-w-xl">
      {step === 'validating' && (
        <div className="flex items-center gap-3 py-6">
          <Spinner /> <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Validating backup…</span>
        </div>
      )}

      {step === 'invalid' && (
        <div>
          <ErrorAlert message="This backup failed validation and cannot be restored." />
          <ul className="text-xs space-y-1 mb-4" style={{ color: 'var(--text-secondary)' }}>
            {(report?.errors || []).map((e, i) => <li key={i}>• {e}</li>)}
          </ul>
          <div className="flex justify-end">
            <button className="btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-4">
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
            Restoring will replace all current data with this backup&rsquo;s data. This cannot be undone from
            within the application (a safety backup of your current data will be created first).
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Backup Created" value={formatDate(report?.metadata?.created_at)} />
            <Field label="Backup Type" value={report?.metadata?.backup_type} />
            <Field label="Application Version" value={report?.metadata?.application_version} />
            <Field label="Includes Media" value={report?.metadata?.includes_media ? 'Yes' : 'No'} />
          </div>
          {report?.warnings?.length > 0 && (
            <ul className="text-xs space-y-1" style={{ color: '#f59e0b' }}>
              {report.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
            </ul>
          )}
          <div className="flex justify-end gap-3">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-danger" onClick={executeRestore}>Replace Current Data and Restore</button>
          </div>
        </div>
      )}

      {step === 'restoring' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Spinner size="lg" />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Restoring — the backend is being restarted. Please do not close the application.
          </p>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{
              background: result?.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${result?.success ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
              color: result?.success ? '#10b981' : '#ef4444',
            }}
          >
            {result?.message}
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => onDone(result)}>Close</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Settings() {
  const { role } = useAuth()
  const [diagnostics, setDiagnostics] = useState(null)
  const [electronInfo, setElectronInfo] = useState(null)
  const [backups, setBackups] = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [restoreTarget, setRestoreTarget] = useState(null)
  const [chooseFilePending, setChooseFilePending] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [diagRes, backupsRes, configRes] = await Promise.all([
        backupService.diagnostics(),
        backupService.list(),
        backupService.getConfig(),
      ])
      setDiagnostics(diagRes.data)
      setBackups(backupsRes.data.backups)
      setConfig(configRes.data)
    } catch {
      toast.error('Could not load settings data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    if (isDesktop()) {
      window.desktopApp.getInfo().then(setElectronInfo).catch(() => {})
    }
  }, [refresh])

  // Belt-and-suspenders UI gate — the route itself, and every backend
  // endpoint independently, already enforce admin-only access.
  if (role !== 'admin') {
    return (
      <div className="card">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Only administrators can access application settings.
        </p>
      </div>
    )
  }

  const chooseFileToRestore = async () => {
    if (!isDesktop()) {
      toast.error('Choosing a backup file requires the desktop application')
      return
    }
    setChooseFilePending(true)
    try {
      const path = await window.desktopApp.backup.chooseFile()
      if (path) setRestoreTarget({ path })
    } finally {
      setChooseFilePending(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Backups, diagnostics, and application information</p>
        </div>
        <button className="btn-secondary text-xs px-3 py-2" onClick={chooseFileToRestore} disabled={chooseFilePending}>
          {chooseFilePending ? <Spinner size="sm" /> : 'Restore from File…'}
        </button>
      </div>

      {loading && !diagnostics ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <>
          <ApplicationInfoCard diagnostics={diagnostics} electronInfo={electronInfo} />
          <BackupsCard backups={backups} config={config} onRefresh={refresh} onRestore={(b) => setRestoreTarget({ path: b.path })} />
          <DiagnosticsCard diagnostics={diagnostics} electronInfo={electronInfo} onRefresh={refresh} />
        </>
      )}

      {restoreTarget && (
        <RestoreModal
          backup={restoreTarget}
          onClose={() => setRestoreTarget(null)}
          onDone={() => {
            setRestoreTarget(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}
