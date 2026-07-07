import { useEffect, useState } from 'react'
import { api } from '../api/api.js'
import LoadingState from '../components/LoadingState.jsx'
import StatCard from '../components/StatCard.jsx'
import IndividualPerformance from './IndividualPerformance.jsx'

export default function PlayersDetails() {
  const [players, setPlayers] = useState(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.adminPlayerDetails()
      .then((data) => {
        setPlayers(data.players)
        setSelectedPlayerId(data.players?.[0]?.player_id || null)
      })
      .catch((loadError) => setError(loadError.message))
  }, [])

  if (!players && !error) return <LoadingState />

  const selectedPlayer = players?.find((player) => player.player_id === selectedPlayerId) || players?.[0]

  return (
    <div className="page players-details-page">
      <div className="page-heading">
        <h2>Players Details</h2>
        <p>Admin view for player account status and individual performance.</p>
      </div>

      {error && <p className="login-error">{error}</p>}

      <div className="players-details-layout">
        <aside className="players-list-panel">
          <h3>Players</h3>
          <div className="players-list">
            {(players || []).map((player) => (
              <button
                key={player.player_id}
                className={selectedPlayer?.player_id === player.player_id ? 'active' : ''}
                type="button"
                onClick={() => setSelectedPlayerId(player.player_id)}
              >
                <strong>{player.username}</strong>
                <span>{player.status} · {player.matches_played} matches</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="players-performance-panel">
          {selectedPlayer ? (
            <>
              <div className="stat-grid four compact-stat-grid">
                <StatCard label="Player" value={selectedPlayer.username} detail={`ID ${selectedPlayer.player_id}`} />
                <StatCard label="Status" value={selectedPlayer.status} detail="account access" tone={selectedPlayer.status === 'Unbanned' ? 'green' : 'red'} />
                <StatCard label="Total Score" value={selectedPlayer.total_score} detail={`${selectedPlayer.matches_played} matches`} />
                <StatCard label="Accuracy" value={`${selectedPlayer.average_accuracy}%`} detail={`${selectedPlayer.enemies_killed} kills`} />
              </div>
              <IndividualPerformance key={selectedPlayer.player_id} playerId={selectedPlayer.player_id} />
            </>
          ) : (
            <div className="empty-state">No player accounts found.</div>
          )}
        </section>
      </div>
    </div>
  )
}
