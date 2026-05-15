import { useEffect, useState } from 'react'
import { api } from '../api/api.js'

export default function Header({ auth, playerId = 1 }) {
  const [player, setPlayer] = useState(null)

  useEffect(() => {
    api.player(playerId).then((data) => setPlayer(data.player)).catch(() => setPlayer(null))
  }, [playerId])

  const username = auth?.user?.username || player?.username || 'Guest'

  return (
    <header className="top-header">
      <div className="player-block">
        <div className="status-orb" />
        <div>
          <h1>{username}</h1>
        </div>
      </div>
    </header>
  )
}
