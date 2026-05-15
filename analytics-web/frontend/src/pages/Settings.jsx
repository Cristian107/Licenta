import { useEffect, useState } from 'react'
import { api } from '../api/api.js'
import ChartCard from '../components/ChartCard.jsx'

export default function Settings({ auth, playerId = 1, onLogout }) {
  const [status, setStatus] = useState('checking')
  const [player, setPlayer] = useState(null)

  useEffect(() => {
    api.health().then(() => setStatus('online')).catch(() => setStatus('offline'))
    api.player(playerId).then((data) => setPlayer(data.player)).catch(() => setPlayer(null))
  }, [playerId])

  return (
    <div className="page settings-grid">
      <div className="page-heading">
        <h2>Settings</h2>
        <p>Local dashboard configuration.</p>
      </div>

      <ChartCard title="Player Profile">
        <div className="settings-row"><span>Player name</span><strong>{auth?.user?.username || player?.username || 'Guest'}</strong></div>
        <div className="settings-row"><span>Role</span><strong>{auth?.user?.role || 'player'}</strong></div>
        <div className="settings-row"><span>Game</span><strong>Cave Explorer</strong></div>
      </ChartCard>

      <ChartCard title="API Status">
        <div className="settings-row"><span>Flask API</span><strong className={status === 'online' ? 'positive' : 'negative'}>{status}</strong></div>
        <div className="settings-row"><span>Endpoint</span><strong>http://127.0.0.1:5000/api</strong></div>
      </ChartCard>

      <ChartCard title="Theme">
        <div className="settings-row"><span>Mode</span><strong>Dark Neon</strong></div>
        <div className="settings-row"><span>Accent</span><strong>#00ff88</strong></div>
        <button className="ghost-button" onClick={() => Object.keys(localStorage).filter((key) => key.startsWith('analytics_ui_')).forEach((key) => localStorage.removeItem(key))}>Clear local UI cache</button>
        <button className="ghost-button danger-button" onClick={onLogout}>Logout</button>
      </ChartCard>
    </div>
  )
}
