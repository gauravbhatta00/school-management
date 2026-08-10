import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './hooks'

import Applications from './pages/Applications'
import TeacherReview from './pages/TeacherReview'
import AdminReview from './pages/AdminReview'
import Layout      from './components/layout/Layout'
import Login       from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard   from './pages/Dashboard'
import StudentPortal from './pages/StudentPortal'
import Students    from './pages/Students'
import Teachers    from './pages/Teachers'
import Attendance  from './pages/Attendance'
import Exams       from './pages/Exams'
import Subjects    from './pages/Subjects'
import Fees        from './pages/Fees'
import Payroll      from './pages/Payroll'
import CalendarHub from './pages/CalendarHub'
import Settings    from './pages/Settings'

// ── Protected Route ─────────────────────────────────────────────────────────
function ProtectedRoute({ children, allowedRoles, staffDesignations }) {
  const { isAuthenticated, isLoading, role, user } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading session…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/" replace />
  if (staffDesignations && role === 'staff' && !staffDesignations.includes(user?.designation)) {
    return <Navigate to="/" replace />
  }

  return children
}

// ── App Shell ────────────────────────────────────────────────────────────────
function AppRoutes() {
  const { isAuthenticated, role } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/forgot-password"
        element={isAuthenticated ? <Navigate to="/" replace /> : <ForgotPassword />}
      />
      <Route
        path="/reset-password/:uid/:token"
        element={isAuthenticated ? <Navigate to="/" replace /> : <ForgotPassword />}
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={role === 'student' ? <StudentPortal /> : <Dashboard />} />

        <Route
          path="students"
          element={
            <ProtectedRoute allowedRoles={['admin', 'teacher', 'staff']}>
              <Students />
            </ProtectedRoute>
          }
        />

        <Route
          path="teachers"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Teachers />
            </ProtectedRoute>
          }
        />

        <Route
          path="attendance"
          element={
            <ProtectedRoute allowedRoles={['admin', 'teacher']}>
              <Attendance />
            </ProtectedRoute>
          }
        />

        <Route
          path="exams"
          element={
            <ProtectedRoute allowedRoles={['admin', 'teacher']}>
              <Exams />
            </ProtectedRoute>
          }
        />

        <Route
          path="subjects"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Subjects />
            </ProtectedRoute>
          }
        />

        <Route
          path="fees"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} staffDesignations={['Accountant', 'Librarian']}>
              <Fees />
            </ProtectedRoute>
          }
        />

        <Route
          path="payroll"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} staffDesignations={['Accountant']}>
              <Payroll />
            </ProtectedRoute>
          }
        />

        <Route
          path="calendar"
          element={
            <ProtectedRoute allowedRoles={['admin', 'teacher', 'staff', 'student']}>
              <CalendarHub />
            </ProtectedRoute>
          }
        />

        <Route
          path="applications"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <Applications />
            </ProtectedRoute>
          }
        />

        <Route
          path="teacher-review"
          element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <TeacherReview />
            </ProtectedRoute>
          }
        />

        <Route
          path="admin-review"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminReview />
            </ProtectedRoute>
          }
        />

        <Route
          path="settings"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Settings />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
