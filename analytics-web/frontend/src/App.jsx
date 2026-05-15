import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { clearAuth, setAuthToken } from './api/api.js'
import Sidebar from './components/Sidebar.jsx'
import Header from './components/Header.jsx'
import Overview from './pages/Overview.jsx'
import MatchHistory from './pages/MatchHistory.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import IndividualPerformance from './pages/IndividualPerformance.jsx'
import CommunityDiscussions from './pages/CommunityDiscussions.jsx'
import ManageAccounts from './pages/ManageAccounts.jsx'
import Settings from './pages/Settings.jsx'
import Login from './pages/Login.jsx'

export default function App() {
  const [auth, setAuth] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    clearAuth()
  }, [])

  function handleLogin(nextAuth) {
    setAuthToken(nextAuth.token)
    setAuth(nextAuth)
    navigate(`/${encodeURIComponent(nextAuth.user.username)}`, { replace: true })
  }

  function handleLogout() {
    clearAuth()
    setAuth(null)
    navigate('/', { replace: true })
  }

  if (!auth?.user) {
    if (location.pathname !== '/') {
      return <Navigate to="/" replace />
    }

    return <Login onLogin={handleLogin} />
  }

  const playerId = auth.player_id || 1
  const username = auth.user.username
  const isAdmin = auth.user.is_admin || username.toLowerCase().includes('admin')

  return (
    <div className="app-shell">
      <Sidebar username={username} isAdmin={isAdmin} onLogout={handleLogout} />
      <main className="main-panel">
        <Header auth={auth} playerId={playerId} />
        <Routes>
          <Route path="/" element={<Navigate to={`/${encodeURIComponent(username)}`} replace />} />
          <Route path="/:username" element={
            <ProtectedUserRoute auth={auth} onUnauthorized={handleLogout}>
              <Overview playerId={playerId} />
            </ProtectedUserRoute>
          } />
          <Route path="/:username/history" element={
            <ProtectedUserRoute auth={auth} onUnauthorized={handleLogout}>
              <MatchHistory playerId={playerId} />
            </ProtectedUserRoute>
          } />
          <Route path="/:username/leaderboard" element={
            <ProtectedUserRoute auth={auth} onUnauthorized={handleLogout}>
              <Leaderboard playerId={playerId} currentUsername={auth.user.username} />
            </ProtectedUserRoute>
          } />
          <Route path="/:username/individual-performance" element={
            <ProtectedUserRoute auth={auth} onUnauthorized={handleLogout}>
              <IndividualPerformance playerId={playerId} />
            </ProtectedUserRoute>
          } />
          <Route path="/:username/individual-performance/:matchId" element={
            <ProtectedUserRoute auth={auth} onUnauthorized={handleLogout}>
              <IndividualPerformance playerId={playerId} />
            </ProtectedUserRoute>
          } />
          <Route path="/:username/community-discussions" element={
            <ProtectedUserRoute auth={auth} onUnauthorized={handleLogout}>
              <CommunityDiscussions auth={auth} />
            </ProtectedUserRoute>
          } />
          <Route path="/:username/manage-accounts" element={
            <ProtectedUserRoute auth={auth} onUnauthorized={handleLogout} requireAdmin>
              <ManageAccounts />
            </ProtectedUserRoute>
          } />
          <Route path="/:username/settings" element={
            <ProtectedUserRoute auth={auth} onUnauthorized={handleLogout}>
              <Settings auth={auth} playerId={playerId} onLogout={handleLogout} />
            </ProtectedUserRoute>
          } />
          <Route path="/:username/*" element={
            <ProtectedUserRoute auth={auth} onUnauthorized={handleLogout}>
              <Navigate to={`/${encodeURIComponent(username)}`} replace />
            </ProtectedUserRoute>
          } />
          <Route path="*" element={<Navigate to={`/${encodeURIComponent(username)}`} replace />} />
        </Routes>
      </main>
    </div>
  )
}

function ProtectedUserRoute({ auth, requireAdmin = false, onUnauthorized, children }) {
  const { username } = useParams()
  const isAuthorized = auth?.user?.username === username
  const isAdmin = auth?.user?.is_admin || auth?.user?.username?.toLowerCase().includes('admin')

  useEffect(() => {
    if (auth?.user && !isAuthorized) {
      onUnauthorized()
    }
  }, [auth, isAuthorized, onUnauthorized])

  if (!auth?.user || !isAuthorized) {
    return <Navigate to="/" replace />
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to={`/${encodeURIComponent(auth.user.username)}`} replace />
  }

  return children
}
