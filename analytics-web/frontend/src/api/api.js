const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api'
let authToken = ''

export function setAuthToken(token = '') {
  authToken = token || ''
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {})
    },
    ...options
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

export const api = {
  health: () => request('/health'),
  login: (credentials) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  }),
  register: (payload) => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  players: () => request('/players'),
  player: (id = 1) => request(`/players/${id}`),
  overview: (id = 1) => request(`/players/${id}/overview`),
  matchHistory: (id = 1) => request(`/players/${id}/match-history`),
  match: (id) => request(`/matches/${id}`),
  leaderboard: () => request('/leaderboard'),
  arsenal: (id = 1) => request(`/weapons/arsenal/${id}`),
  individualPerformance: (playerId = 1, matchId) => request(`/players/${playerId}/individual-performance/${matchId}`),
  createMatch: (payload) => request('/matches', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  discussions: () => request('/discussions'),
  createDiscussion: (payload) => request('/discussions', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  createDiscussionComment: (postId, payload) => request(`/discussions/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  adminAccounts: () => request('/admin/accounts'),
  adminPlayerDetails: () => request('/admin/player-details'),
  updateAccountStatus: (userId, isBanned) => request(`/admin/accounts/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_banned: isBanned })
  }),
  deleteAccount: (userId) => request(`/admin/accounts/${userId}`, {
    method: 'DELETE'
  })
}

export function clearAuth() {
  setAuthToken('')
  localStorage.removeItem('analytics_auth')
}

export function formatDuration(seconds = 0) {
  const total = Number(seconds) || 0
  const minutes = Math.floor(total / 60)
  const remaining = Math.floor(total % 60)
  return `${minutes}:${remaining.toString().padStart(2, '0')}`
}

export function compactNumber(value = 0) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
