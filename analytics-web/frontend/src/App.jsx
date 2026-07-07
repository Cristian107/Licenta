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
import PlayersDetails from './pages/PlayersDetails.jsx'
import Settings from './pages/Settings.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'

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
    const nextIsAdmin = nextAuth.user.is_admin || nextAuth.user.username.toLowerCase().includes('admin')
    const nextPath = nextIsAdmin
      ? `/${encodeURIComponent(nextAuth.user.username)}/leaderboard`
      : `/${encodeURIComponent(nextAuth.user.username)}`
    navigate(nextPath, { replace: true })
  }

  function handleLogout() {
    clearAuth()
    setAuth(null)
    navigate('/', { replace: true })
  }

  if (!auth?.user) {
    if (location.pathname === '/register') {
      return <Register onRegister={handleLogin} />
    }

    if (location.pathname !== '/') {
      return <Navigate to="/" replace />
    }

    return <Login onLogin={handleLogin} />
  }

  const playerId = auth.player_id || 1
  const username = auth.user.username
  const isAdmin = auth.user.is_admin || username.toLowerCase().includes('admin')
  const homePath = isAdmin ? `/${encodeURIComponent(username)}/leaderboard` : `/${encodeURIComponent(username)}`

  return (
    <div className="app-shell">
      <Sidebar username={username} isAdmin={isAdmin} onLogout={handleLogout} />
      <main className="main-panel">
        <Header auth={auth} playerId={playerId} />
        <Routes>
          <Route path="/" element={<Navigate to={homePath} replace />} />
          <Route path="/:username" element={
            <ProtectedUserRoute auth={auth} onUnauthorized={handleLogout} adminAllowed>
              {isAdmin ? <Navigate to={homePath} replace /> : <Overview playerId={playerId} />}
            </ProtectedUserRoute>
          } />
          <Route path="/:username/history" element={
            <ProtectedUserRoute auth={auth} onUnauthorized={handleLogout}>
              <MatchHistory playerId={playerId} />
            </ProtectedUserRoute>
          } />
          <Route path="/:username/leaderboard" element={
            <ProtectedUserRoute auth={auth} onUnauthorized={handleLogout} adminAllowed>
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
            <ProtectedUserRoute auth={auth} onUnauthorized={handleLogout} requireAdmin adminAllowed>
              <ManageAccounts />
            </ProtectedUserRoute>
          } />
          <Route path="/:username/players-details" element={
            <ProtectedUserRoute auth={auth} onUnauthorized={handleLogout} requireAdmin adminAllowed>
              <PlayersDetails />
            </ProtectedUserRoute>
          } />
          <Route path="/:username/settings" element={
            <ProtectedUserRoute auth={auth} onUnauthorized={handleLogout}>
              <Settings auth={auth} playerId={playerId} onLogout={handleLogout} />
            </ProtectedUserRoute>
          } />
          <Route path="/:username/*" element={
            <ProtectedUserRoute auth={auth} onUnauthorized={handleLogout} adminAllowed>
              <Navigate to={homePath} replace />
            </ProtectedUserRoute>
          } />
          <Route path="*" element={<Navigate to={homePath} replace />} />
        </Routes>
      </main>
    </div>
  )
}

function ProtectedUserRoute({ auth, requireAdmin = false, adminAllowed = false, onUnauthorized, children }) {
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

  if (isAdmin && !adminAllowed) {
    return <Navigate to={`/${encodeURIComponent(auth.user.username)}/leaderboard`} replace />
  }

  return children
}
