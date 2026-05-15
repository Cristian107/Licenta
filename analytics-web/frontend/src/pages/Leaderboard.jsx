import { useEffect, useState } from 'react'
import { api } from '../api/api.js'
import LoadingState from '../components/LoadingState.jsx'
import WeaponCard from '../components/WeaponCard.jsx'

export default function Leaderboard({ playerId = 1, currentUsername = '' }) {
  const [leaderboard, setLeaderboard] = useState(null)
  const [arsenal, setArsenal] = useState([])

  useEffect(() => {
    api.leaderboard().then((data) => setLeaderboard(data.leaderboard))
    api.arsenal(playerId).then((data) => setArsenal(data.arsenal))
  }, [playerId])

  if (!leaderboard) return <LoadingState />

  return (
    <div className="page leaderboard-layout">
      <div>
        <div className="page-heading">
          <h2>Leaderboard</h2>
          <p>Global ranking calculated from total match score.</p>
        </div>
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
