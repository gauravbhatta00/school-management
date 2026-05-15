/**
 * Axios instance pre-configured for the Django REST backend.
 *
 * Interceptors handle:
 *   - Injecting the Bearer token into every request
 *   - Automatically refreshing the access token on 401 and retrying
 *   - Logging out cleanly when refresh itself fails
 */

import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: attach access token ──────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ── Response interceptor: auto-refresh on 401 ────────────────────────────────
let isRefreshing = false
let failedQueue = []   // requests waiting for the new token

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error)
    else prom.resolve(token)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue subsequent requests until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) {
        isRefreshing = false
        logout()
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/api/auth/jwt/refresh/`, {
          refresh: refreshToken,
        })
        localStorage.setItem('access_token', data.access)
        api.defaults.headers.common.Authorization = `Bearer ${data.access}`
        processQueue(null, data.access)
        originalRequest.headers.Authorization = `Bearer ${data.access}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        logout()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

function logout() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user')
  window.location.href = '/login'
}

const multipartConfig = (data) => (
  data instanceof FormData
    ? { headers: { 'Content-Type': 'multipart/form-data' } }
    : undefined
)

// ── Typed service modules ─────────────────────────────────────────────────────

export const authService = {
  login: (email, password) =>
    api.post('/api/auth/jwt/create/', { email, password }),
  me: () => api.get('/api/users/me/'),
  refreshToken: (refresh) =>
    api.post('/api/auth/jwt/refresh/', { refresh }),
  requestPasswordReset: (email) =>
    api.post('/api/auth/users/reset_password/', { email }),
  confirmPasswordReset: ({ uid, token, newPassword }) =>
    api.post('/api/auth/users/reset_password_confirm/', {
      uid,
      token,
      new_password: newPassword,
    }),
}

export const dashboardService = {
  stats: () => api.get('/api/users/dashboard_stats/'),
  studentPortal: () => api.get('/api/users/student_portal/'),
}

export const schoolService = {
  list:   ()       => api.get('/api/schools/'),
  get:    (id)     => api.get(`/api/schools/${id}/`),
  create: (data)   => api.post('/api/schools/', data),
  update: (id, d)  => api.patch(`/api/schools/${id}/`, d),
  delete: (id)     => api.delete(`/api/schools/${id}/`),
}

export const studentService = {
  list:   (params) => api.get('/api/students/', { params }),
  get:    (id)     => api.get(`/api/students/${id}/`),
  create: (data)   => api.post('/api/students/', data),
  importCsv: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/api/students/import-csv/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  update: (id, d)  => api.patch(`/api/students/${id}/`, d, multipartConfig(d)),
  delete: (id)     => api.delete(`/api/students/${id}/`),
}

export const teacherService = {
  list:    (params) => api.get('/api/teachers/', { params }),
  get:     (id)     => api.get(`/api/teachers/${id}/`),
  create:  (data)   => api.post('/api/teachers/', data),
  update:  (id, d)  => api.patch(`/api/teachers/${id}/`, d, multipartConfig(d)),
  delete:  (id)     => api.delete(`/api/teachers/${id}/`),
  subjects: (params) => api.get('/api/teachers/subjects/', { params }),
}

export const applicationService = {
  list:            (params)    => api.get('/api/applications/', { params }),
  get:             (id)        => api.get(`/api/applications/${id}/`),
  create:          (data)      => api.post('/api/applications/', data),
  myApplications:  ()          => api.get('/api/applications/my_applications/'),
  pendingReview:   (params)    => api.get('/api/applications/pending_review/', { params }),
  teacherResponse: (id, data)  => api.post(`/api/applications/${id}/teacher_response/`, data),
  adminReview:     (id, data)  => api.post(`/api/applications/${id}/admin_review/`, data),
  stats:           ()          => api.get('/api/applications/stats/'),
}

export const attendanceService = {
  list:     (params) => api.get('/api/attendance/', { params }),
  bulkMark: (data)   => api.post('/api/attendance/bulk-mark/', data),
  report:   (params) => api.get('/api/attendance/report/', { params }),
  downloadReport: (params) =>
    api.get('/api/attendance/report/', {
      params: { ...params, export: 'csv' },
      responseType: 'blob',
    }),
  teacherSelf: {
    list: () => api.get('/api/attendance/teacher-self/'),
    save: (data) => api.post('/api/attendance/teacher-self/', data),
  },
  teacherRecords: {
    list: (params) => api.get('/api/attendance/teacher-records/', { params }),
    save: (data) => api.post('/api/attendance/teacher-records/', data),
  },
}

export const examService = {
  list:         (params) => api.get('/api/exams/', { params }),
  create:       (data)   => api.post('/api/exams/', data),
  update:       (id, d)  => api.patch(`/api/exams/${id}/`, d),
  delete:       (id)     => api.delete(`/api/exams/${id}/`),
}

export const subjectService = {
  list:   (params) => api.get('/api/subjects/', { params }),
  create: (data)   => api.post('/api/subjects/', data),
  update: (id, d)  => api.patch(`/api/subjects/${id}/`, d),
  delete: (id)     => api.delete(`/api/subjects/${id}/`),
}

export const resultService = {
  list:         (params) => api.get('/api/results/', { params }),
  create:       (data)   => api.post('/api/results/', data),
  update:       (id, d)  => api.patch(`/api/results/${id}/`, d),
  studentCard:  (params) => api.get('/api/results/student-card/', { params }),
  classSummary: (params) => api.get('/api/results/class-summary/', { params }),
}

export const feeService = {
  structures:        (params) => api.get('/api/fee-structures/', { params }),
  createStructure:   (data)   => api.post('/api/fee-structures/', data),
  payments:          (params) => api.get('/api/payments/', { params }),
  pay:               (data)   => api.post('/api/payments/pay/', data),
  studentStatus:     (params) => api.get('/api/payments/student-status/', { params }),
  collectionSummary: (params) => api.get('/api/payments/collection-summary/', { params }),
  feeReport:         (params) => api.get('/api/payments/fee-report/', { params }),
  downloadFeeReport: (params) =>
    api.get('/api/payments/fee-report/', {
      params: { ...params, export: 'csv' },
      responseType: 'blob',
    }),
}

export const communicationService = {
  notices:      (params) => api.get('/api/notices/', { params }),
  createNotice: (data)   => api.post('/api/notices/', data),
  updateNotice: (id, d)  => api.patch(`/api/notices/${id}/`, d),
  events:       (params) => api.get('/api/calendar-events/', { params }),
  createEvent:  (data)   => api.post('/api/calendar-events/', data),
  updateEvent:  (id, d)  => api.patch(`/api/calendar-events/${id}/`, d),
}

export const userService = {
  list:   (params) => api.get('/api/users/', { params }),
  create: (data)   => api.post('/api/users/', data),
  update: (id, d)  => api.patch(`/api/users/${id}/`, d),
  me:     ()       => api.get('/api/users/me/'),
  updateMe: (d)    => api.patch('/api/users/me/', d, multipartConfig(d)),
  delete: (id)     => api.delete(`/api/users/${id}/`),
}

export default api
