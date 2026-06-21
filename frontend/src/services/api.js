// EduTest Pro — API client (native fetch).
// Teacher/Admin auth: httpOnly cookies (credentials: 'include') + silent JWT refresh on 401.
// Student exam auth: in-memory JWT sent as `Authorization: Student <jwt>`.

const BASE = '/api/v1'

// ── Student session (in memory only, never localStorage) ────────────────────
let studentToken = null
let studentAttemptId = null
export const setStudentToken = (t) => { studentToken = t }
export const getStudentToken = () => studentToken
export const setStudentAttemptId = (id) => { studentAttemptId = id }
export const getStudentAttemptId = () => studentAttemptId
export const clearStudentSession = () => { studentToken = null; studentAttemptId = null }

// ── 401 refresh queue (teacher cookie auth) ─────────────────────────────────
let refreshing = null

async function tryRefreshToken() {
  // The httpOnly refresh_token cookie is sent automatically; no body needed.
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => { const p = refreshing; queueMicrotask(() => { if (refreshing === p) refreshing = null }) })
  }
  return refreshing
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.status = status
    this.data = data
  }
}

async function request(path, { method = 'GET', body, student = false, raw = false } = {}) {
  const headers = {}
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  if (student && studentToken) {
    headers['Authorization'] = `Student ${studentToken}`
  }

  const opts = {
    method,
    headers,
    credentials: 'include',
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  }

  let res = await fetch(`${BASE}${path}`, opts)

  // Silent refresh once on 401 for teacher (cookie) requests.
  if (res.status === 401 && !student) {
    const ok = await tryRefreshToken()
    if (ok) res = await fetch(`${BASE}${path}`, opts)
  }

  if (raw) return res

  let data = null
  const text = await res.text()
  if (text) {
    try { data = JSON.parse(text) } catch { data = text }
  }

  if (!res.ok) {
    const msg = (data && (data.error || data.detail || data.message)) || `HTTP ${res.status}`
    throw new ApiError(msg, res.status, data)
  }
  return data
}

export const api = {
  get: (p, o) => request(p, { ...o, method: 'GET' }),
  post: (p, body, o) => request(p, { ...o, method: 'POST', body }),
  patch: (p, body, o) => request(p, { ...o, method: 'PATCH', body }),
  put: (p, body, o) => request(p, { ...o, method: 'PUT', body }),
  del: (p, o) => request(p, { ...o, method: 'DELETE' }),
  raw: request,
}

// ── Auth helpers (teacher/admin) ────────────────────────────────────────────
export const authApi = {
  login: (username, password) => api.post('/auth/login/', { email: username, password }),
  logout: () => api.post('/auth/logout/'),
  me: () => api.get('/auth/me/'),
  changePassword: (old_password, new_password) =>
    api.post('/auth/change-password/', { old_password, new_password }),
  notifications: () => api.get('/auth/me/notifications/'),
  updateNotifications: (prefs) => api.patch('/auth/me/notifications/', prefs),
}

// ── Student exam flow ───────────────────────────────────────────────────────
export const studentApi = {
  lookup: (examSlug, code) => api.post('/auth/student/lookup/', { exam_slug: examSlug, code }),
  login: (examSlug, code) => api.post('/auth/student/login/', { exam_slug: examSlug, code }),
  state: (attemptId) => api.get(`/attempts/${attemptId}/state/`, { student: true }),
  detail: (attemptId) => api.get(`/attempts/${attemptId}/detail/`, { student: true }),
  saveAnswer: (attemptId, payload) =>
    api.post(`/attempts/${attemptId}/answer/`, payload, { student: true }),
  heartbeat: (attemptId) => api.post(`/attempts/${attemptId}/heartbeat/`, undefined, { student: true }),
  reportEvent: (attemptId, payload) =>
    api.post(`/attempts/${attemptId}/events/`, payload, { student: true }),
  finish: (attemptId, payload) =>
    api.post(`/attempts/${attemptId}/finish/`, payload, { student: true }),
  publicExam: (slug) => api.get(`/exams/public/${slug}/`),
}
