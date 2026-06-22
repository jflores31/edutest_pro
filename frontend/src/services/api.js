/**
 * api.js — Cliente API centralizado
 * Maneja JWT, refresh token con cola, timeout, y endpoints del backend
 */

export const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';
const REQUEST_TIMEOUT = 30000;

// Token management for student exam sessions (temporary, not httpOnly)
let studentAccessToken = null;

export function setStudentToken(token) {
  studentAccessToken = token;
}

export function getStudentToken() {
  return studentAccessToken;
}

// Teacher auth uses httpOnly cookies set by the backend
// Refresh token queue for teacher cookie-based auth
let isRefreshing = false;
let refreshQueue = [];

export function setTokens(access, refresh) {
  // Teacher tokens are now in httpOnly cookies — this function is kept
  // for backward compat and for student session storage
  if (access) localStorage.setItem('access_token', access);
  if (refresh) localStorage.setItem('refresh_token', refresh);
}

export function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  studentAccessToken = null;
}

export function getAccessToken() {
  return localStorage.getItem('access_token');
}

// ============================================================
// Refresh token with queue (uses httpOnly cookie automatically)
// ============================================================
async function tryRefreshToken() {
  // Si ya hay un refresh en curso, esperar a que termine
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      refreshQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!res.ok) {
      clearTokens();
      refreshQueue.forEach(({ reject }) => reject(new Error('Refresh failed')));
      refreshQueue = [];
      return false;
    }

    const data = await res.json();
    if (data.access) localStorage.setItem('access_token', data.access);

    refreshQueue.forEach(({ resolve }) => resolve(true));
    refreshQueue = [];
    return true;
  } catch (err) {
    clearTokens();
    refreshQueue.forEach(({ reject }) => reject(err));
    refreshQueue = [];
    return false;
  } finally {
    isRefreshing = false;
  }
}

// ============================================================
// Request con timeout
// ============================================================
async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Teacher auth uses httpOnly cookies (sent automatically with credentials: 'include')
  // Student exam auth uses Student <jwt> header
  if (studentAccessToken) {
    headers.Authorization = `Student ${studentAccessToken}`;
  }

  // Timeout con AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
      signal: options.signal || controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle 401 — try refresh for teacher auth
    if (res.status === 401 && !studentAccessToken) {
      try {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          // Use a fresh AbortController — the original may have already fired
          const retryController = new AbortController();
          const retryTimeout = setTimeout(() => retryController.abort(), REQUEST_TIMEOUT);
          try {
            return await fetch(`${API_BASE}${path}`, {
              ...options,
              headers,
              credentials: 'include',
              signal: retryController.signal,
            });
          } finally {
            clearTimeout(retryTimeout);
          }
        }
      } catch {
        // Refresh falló, devolver respuesta 401 original
      }
    }

    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado. Verifica tu conexión.', { cause: err });
    }
    throw err;
  }
}

// ============================================================
// HTTP helpers
// ============================================================

// Extracts a human-readable message from a DRF/JSON error body:
// { detail }, { error }, or DRF field errors like { code: ["..."] }.
function errorMessage(data, res, path) {
  if (data?.detail) return data.detail;
  if (data?.error) return data.error;
  if (data && typeof data === 'object') {
    for (const v of Object.values(data)) {
      if (Array.isArray(v) && v.length && typeof v[0] === 'string') return v[0];
      if (typeof v === 'string') return v;
    }
  }
  return `${res.status} ${path}`;
}

async function get(path) {
  const res = await request(path);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(errorMessage(data, res, path));
  }
  return res.json();
}

// Fetches all pages of a paginated DRF response and returns a flat array
async function getAll(path) {
  const results = [];
  let nextPath = path;
  while (nextPath) {
    const data = await get(nextPath);
    if (Array.isArray(data)) return data;
    results.push(...(data.results ?? []));
    if (!data.next) break;
    // Strip origin + API base to get a relative path for the next request
    nextPath = data.next.replace(window.location.origin + API_BASE, '');
  }
  return results;
}

async function post(path, body) {
  const res = await request(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(errorMessage(data, res, path));
  }
  return res.status === 204 ? null : res.json();
}

async function patch(path, body) {
  const res = await request(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(errorMessage(data, res, path));
  }
  return res.status === 204 ? null : res.json();
}

async function del(path) {
  const res = await request(path, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(errorMessage(data, res, path));
  }
  return res.status === 204 ? null : res.json();
}

async function upload(path, formData) {
  const headers = {};
  if (studentAccessToken) {
    headers.Authorization = `Student ${studentAccessToken}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(errorMessage(data, res, path));
    }
    return res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('La subida tardó demasiado. Intenta con un archivo más pequeño.', { cause: err });
    }
    throw err;
  }
}

// ============================================================
// AUTH
// ============================================================

export const auth = {
  login: (email, password) => post('/auth/login/', { email, password }),
  logout: () => post('/auth/logout/'),
  studentLookup: (examSlug, code) =>
    post('/auth/student/lookup/', { exam_slug: examSlug, code }),
  studentLogin: (examSlug, code) =>
    post('/auth/student/login/', { exam_slug: examSlug, code }),
  me: () => get('/auth/me/'),
  updateMe: (data) => patch('/auth/me/', data),
  changePassword: (current, newPassword) => post('/auth/change-password/', { current_password: current, new_password: newPassword }),
};

// ============================================================
// EXAMS
// ============================================================

export const exams = {
  list: (params) => getAll(`/exams/${params ? '?' + new URLSearchParams(params) : ''}`),
  get: (id) => get(`/exams/${id}/`),
  create: (data) => post('/exams/', data),
  update: (id, data) => patch(`/exams/${id}/`, data),
  delete: (id) => del(`/exams/${id}/`),
  publish: (id) => post(`/exams/${id}/publish/`),
  unpublish: (id) => post(`/exams/${id}/unpublish/`),
  archive: (id) => post(`/exams/${id}/archive/`),
  duplicate: (id) => post(`/exams/${id}/duplicate/`),
  unarchive: (id) => post(`/exams/${id}/unarchive/`),
  addQuestion: (id, questionId, order, points) => post(`/exams/${id}/questions/add/`, { question_id: questionId, order, points }),
  getPublic: (slug) => get(`/exams/public/${slug}/`),
  compare: (ids) => get(`/exams/compare/?ids=${ids.join(',')}`),
  monitoring: (id) => get(`/exams/${id}/monitoring/`),
  importExam: (formData) => upload('/exams/import/', formData),
};

// ============================================================
// QUESTIONS
// ============================================================

export const questions = {
  list: (params) => getAll(`/questions/${params ? '?' + new URLSearchParams(params) : ''}`),
  get: (id) => get(`/questions/${id}/`),
  create: (data) => post('/questions/', data),
  update: (id, data) => patch(`/questions/${id}/`, data),
  delete: (id) => del(`/questions/${id}/`),
};

// ============================================================
// ATTEMPTS
// ============================================================

export const attempts = {
  get: (id) => get(`/attempts/${id}/`),
  detail: (id) => get(`/attempts/${id}/detail/`),
  state: (id) => get(`/attempts/${id}/state/`),
  answer: (id, questionId, answerData) => post(`/attempts/${id}/answer/`, { question_id: questionId, answer_data: answerData }),
  heartbeat: (id) => post(`/attempts/${id}/heartbeat/`),
  finish: (id) => post(`/attempts/${id}/finish/`),
  event: (id, type, payload) => post(`/attempts/${id}/events/`, { event_type: type, payload }),
};

// ============================================================
// STUDENTS
// ============================================================

export const imports = {
  preview: (formData) => upload('/imports/preview/', formData),
};

export const students = {
  list: (params) => getAll(`/students/${params ? '?' + new URLSearchParams(params) : ''}`),
  get: (id) => get(`/students/${id}/`),
  create: (data) => post('/students/', data),
  update: (id, data) => patch(`/students/${id}/`, data),
  delete: (id) => del(`/students/${id}/`),
  profile: (id) => get(`/students/${id}/profile/`),
  reportCard: (id, format = 'json') => get(`/students/${id}/report-card/?output=${format}`),
  importFile: (courseId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('course_id', courseId);
    return upload('/students/import/', fd);
  },
  exportCsv: async (courseId) => {
    const headers = {};
    if (studentAccessToken) {
      headers.Authorization = `Student ${studentAccessToken}`;
    }
    const qs = courseId ? `?course_id=${encodeURIComponent(courseId)}` : '';
    const res = await fetch(`${API_BASE}/students/export/${qs}`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alumnos.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  reportCardPdf: async (id, code) => {
    const headers = {};
    if (studentAccessToken) {
      headers.Authorization = `Student ${studentAccessToken}`;
    }
    const res = await fetch(`${API_BASE}/students/${id}/report-card/?output=pdf`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boletin_${code}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

// ============================================================
// COURSES
// ============================================================

export const courses = {
  list: () => getAll('/courses/'),
  get: (id) => get(`/courses/${id}/`),
  create: (data) => post('/courses/', data),
  update: (id, data) => patch(`/courses/${id}/`, data),
  delete: (id) => del(`/courses/${id}/`),
};

// ============================================================
// TEMPLATES
// ============================================================

export const templates = {
  list: () => get('/exam-templates/'),
  get: (id) => get(`/exam-templates/${id}/`),
  create: (data) => post('/exam-templates/', data),
  update: (id, data) => patch(`/exam-templates/${id}/`, data),
  delete: (id) => del(`/exam-templates/${id}/`),
  instantiate: (id) => post(`/exam-templates/${id}/instantiate/`),
};

// ============================================================
// DASHBOARD
// ============================================================

export const dashboard = {
  stats: (period = '30d', courseId = '') => {
    const p = new URLSearchParams({ period });
    if (courseId) p.set('course_id', courseId);
    return get(`/dashboard/?${p}`);
  },
  live: (courseId = '') => get(`/dashboard/live/${courseId ? `?course_id=${courseId}` : ''}`),
  heatmap: () => get('/dashboard/heatmap/'),
  topQuestions: () => get('/dashboard/top-questions/'),
};

// ============================================================
// INTEGRATIONS
// ============================================================

export const integrations = {
  list: () => get('/integrations/'),
  toggle: (key) => post(`/integrations/${key}/toggle/`),
};

// ============================================================
// NOTIFICATIONS
// ============================================================

export const notifications = {
  list: () => get('/notifications/'),
  getPrefs: () => get('/auth/me/notifications/'),
  updatePrefs: (data) => patch('/auth/me/notifications/', data),
};

export default {
  auth,
  exams,
  questions,
  attempts,
  students,
  courses,
  templates,
  dashboard,
  integrations,
  notifications,
  imports,
};
