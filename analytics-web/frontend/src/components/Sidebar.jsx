import { Activity, BarChart3, History, LogOut, Medal, MessageSquareText, Settings, ShieldCheck, UserRound } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const links = [
  { path: '', label: 'Overview', icon: BarChart3, end: true },
  { path: 'history', label: 'Match History', icon: History },
  { path: 'leaderboard', label: 'Leaderboard', icon: Medal },
  { path: 'individual-performance', label: 'Individual Performance', icon: UserRound },
  { path: 'community-discussions', label: 'Community Discussions', icon: MessageSquareText },
  { path: 'manage-accounts', label: 'Manage Accounts', icon: ShieldCheck, adminOnly: true },
  { path: 'settings', label: 'Settings', icon: Settings }
]

export default function Sidebar({ username, isAdmin = false, onLogout }) {
  const basePath = `/${encodeURIComponent(username || '')}`

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Activity size={20} /></div>
        <span>Explorer's Journal</span>
      </div>
      <nav className="nav-list">
        {links.filter((link) => !link.adminOnly || isAdmin).map(({ path, label, icon: Icon, end }) => {
          const to = path ? `${basePath}/${path}` : basePath
          return (
            <NavLink key={path || 'overview'} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          )
        })}
      </nav>
      <button className="nav-link logout-button" type="button" onClick={onLogout}>
        <LogOut size={18} />
        <span>Logout</span>
      </button>
    </aside>
  )
}
