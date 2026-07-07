import { useEffect, useState } from 'react'
import { api } from '../api/api.js'
import LoadingState from '../components/LoadingState.jsx'
import WeaponCard from '../components/WeaponCard.jsx'

export default function Leaderboard({ playerId = 1, currentUsername = '' }) {
  const [leaderboard, setLeaderboard] = useState(null)
  const [arsenal, setArsenal] = useState([])
  const [alertsEnabled, setAlertsEnabled] = useState(() => localStorage.getItem('leaderboard_alerts') === 'on')
  const [alertMessage, setAlertMessage] = useState('')

  useEffect(() => {
    let mounted = true

    async function loadLeaderboard() {
      const data = await api.leaderboard()
      if (!mounted) return

      setLeaderboard(data.leaderboard)
      updateLeaderboardAlert(data.leaderboard)
    }

    loadLeaderboard()
    const interval = alertsEnabled ? window.setInterval(loadLeaderboard, 15000) : null
    return () => {
      mounted = false
      if (interval) window.clearInterval(interval)
    }
  }, [alertsEnabled])

  useEffect(() => {
    api.arsenal(playerId).then((data) => setArsenal(data.arsenal))
  }, [playerId])

  function updateLeaderboardAlert(nextLeaderboard) {
    if (!nextLeaderboard?.length) return

    const previousSnapshot = JSON.parse(localStorage.getItem('leaderboard_snapshot') || '[]')
    const previousByName = new Map(previousSnapshot.map((row) => [row.username, row.rank]))

    if (alertsEnabled && previousSnapshot.length > 0) {
      const promotedPlayer = nextLeaderboard.find((row) => {
        const previousRank = previousByName.get(row.username)
        return previousRank && row.rank < previousRank
      })

      if (promotedPlayer) {
        if (promotedPlayer.rank === 1) {
          setAlertMessage(`${promotedPlayer.username} is now in first place!`)
        } else {
          setAlertMessage(`${promotedPlayer.username} climbed to rank #${promotedPlayer.rank}!`)
        }
      }
    }

    localStorage.setItem('leaderboard_snapshot', JSON.stringify(
      nextLeaderboard.map((row) => ({ username: row.username, rank: row.rank }))
    ))
  }

  function toggleAlerts() {
    const nextValue = !alertsEnabled
    setAlertsEnabled(nextValue)
    localStorage.setItem('leaderboard_alerts', nextValue ? 'on' : 'off')

    if (nextValue) {
      if (leaderboard?.length) {
        localStorage.setItem('leaderboard_snapshot', JSON.stringify(
          leaderboard.map((row) => ({ username: row.username, rank: row.rank }))
        ))
      }
      setAlertMessage('Leaderboard alerts enabled.')
    } else {
      setAlertMessage('Leaderboard alerts disabled.')
    }
  }

  if (!leaderboard) return <LoadingState />

  return (
    <div className="page leaderboard-layout">
      <div>
        <div className="page-heading with-actions">
          <div>
            <h2>Leaderboard</h2>
            <p>Global ranking calculated from total match score.</p>
          </div>
          <button className={`alert-toggle-button ${alertsEnabled ? 'active' : ''}`} type="button" onClick={toggleAlerts}>
            {alertsEnabled ? 'Alerts On' : 'Enable Alerts'}
          </button>
        </div>
        {alertMessage && (
          <div className="leaderboard-alert">
            <span>{alertMessage}</span>
            <button type="button" onClick={() => setAlertMessage('')}>Dismiss</button>
          </div>
        )}
        <section className="table-card">
          <h3>Global Leaderboard</h3>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Total Score</th>
                <th>High Score</th>
                <th>Kills</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row) => (
                <tr key={row.player_id} className={row.username === currentUsername ? 'self-row' : ''}>
                  <td>#{row.rank}</td>
                  <td>{row.username}</td>
                  <td>{row.total_score}</td>
                  <td>{row.high_score}</td>
                  <td>{row.kills}</td>
                  <td>{row.average_accuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <aside className="arsenal-panel">
        <h3>Weapon Arsenal</h3>
        <p>Mastery and combat output by weapon.</p>
        <div className="weapon-list">
          {arsenal.map((weapon) => <WeaponCard key={weapon.weapon_name} weapon={weapon} />)}
        </div>
      </aside>
    </div>
  )
}
