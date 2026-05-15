import { useEffect, useState } from 'react'
import { api, formatDuration } from '../api/api.js'
import LoadingState from '../components/LoadingState.jsx'
import StatCard from '../components/StatCard.jsx'

export default function MatchHistory({ playerId = 1 }) {
  const [matches, setMatches] = useState(null)
  const [resultFilter, setResultFilter] = useState('all')
  const [levelFilter, setLevelFilter] = useState('all')
  const [sortKey, setSortKey] = useState('date')
  const [selectedMatchId, setSelectedMatchId] = useState(null)

  useEffect(() => {
    api.matchHistory(playerId).then((data) => {
      setMatches(data.matches)
      setSelectedMatchId(data.matches?.[0]?.id || null)
    })
  }, [playerId])

  if (!matches) return <LoadingState />

  const filteredMatches = matches
    .filter((match) => resultFilter === 'all' || match.result.toLowerCase() === resultFilter)
    .filter((match) => levelFilter === 'all' || match.level_name === levelFilter)
    .sort((a, b) => {
      if (sortKey === 'duration') return b.duration_seconds - a.duration_seconds
      if (sortKey === 'score') return b.score - a.score
      return new Date(b.started_at) - new Date(a.started_at)
    })

  const selectedMatch = filteredMatches.find((match) => match.id === selectedMatchId) || filteredMatches[0]

  async function downloadSelectedMatchDetails() {
    if (!selectedMatch) return

    const details = await api.match(selectedMatch.id)
    const content = JSON.stringify(details, null, 2)
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `match-${selectedMatch.id}-details.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page">
      <div className="page-heading">
        <h2>Match History</h2>
        <p>Last 10 rounds received from the Unity client.</p>
      </div>

      <section className="table-card">
        <div className="history-toolbar">
          <div className="segmented-control">
            <button className={resultFilter === 'all' ? 'active' : ''} onClick={() => setResultFilter('all')}>All</button>
            <button className={resultFilter === 'victory' ? 'active' : ''} onClick={() => setResultFilter('victory')}>Win</button>
            <button className={resultFilter === 'defeat' ? 'active' : ''} onClick={() => setResultFilter('defeat')}>Lose</button>
          </div>
          <div className="segmented-control">
            <button className={levelFilter === 'all' ? 'active' : ''} onClick={() => setLevelFilter('all')}>All Levels</button>
            <button className={levelFilter === 'Crystal Caves' ? 'active' : ''} onClick={() => setLevelFilter('Crystal Caves')}>Crystal Caves</button>
            <button className={levelFilter === 'Cave Bridge' ? 'active' : ''} onClick={() => setLevelFilter('Cave Bridge')}>Cave Bridge</button>
          </div>
          <div className="segmented-control">
            <button className={sortKey === 'duration' ? 'active' : ''} onClick={() => setSortKey('duration')}>Duration</button>
            <button className={sortKey === 'score' ? 'active' : ''} onClick={() => setSortKey('score')}>Score</button>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Match</th>
              <th>Date / Time</th>
              <th>Result</th>
              <th>Score</th>
              <th>Level</th>
              <th>Duration</th>
              <th>Kills</th>
              <th>Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {filteredMatches.map((match, index) => (
              <tr key={match.id} className={selectedMatch?.id === match.id ? 'self-row clickable-row' : 'clickable-row'} onClick={() => setSelectedMatchId(match.id)}>
                <td>#{filteredMatches.length - index}</td>
                <td>{formatDate(match.started_at)}</td>
                <td><span className={`pill ${match.result.toLowerCase()}`}>{match.result}</span></td>
                <td>{match.score}</td>
                <td>{match.level_name}</td>
                <td>{formatDuration(match.duration_seconds)}</td>
                <td>{match.enemies_killed}</td>
                <td>{match.accuracy}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {selectedMatch && (
        <>
          <div className="match-detail-actions">
            <button className="download-details-button" type="button" onClick={downloadSelectedMatchDetails}>
              Download Details
            </button>
          </div>
          <div className="stat-grid three match-detail-grid">
            <StatCard
              label="Most Used Weapon"
              value={selectedMatch.details?.most_used_weapon || 'N/A'}
              detail={`${selectedMatch.details?.most_used_weapon_time || '0:00'} active time`}
            />
            <StatCard
              label="Top Kill Weapon"
              value={selectedMatch.details?.top_kill_weapon || 'N/A'}
              detail={`${selectedMatch.details?.top_kill_weapon_kills || 0} enemies killed`}
            />
            <StatCard
              label="Coins Collected"
              value={selectedMatch.details?.coins_collected ?? selectedMatch.coins_collected ?? 0}
              detail="from this match"
            />
          </div>
        </>
      )}
    </div>
  )
}

function formatDate(value) {
  return new Date(value).toLocaleString('ro-RO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
