import { useEffect, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, compactNumber } from '../api/api.js'
import StatCard from '../components/StatCard.jsx'
import ChartCard from '../components/ChartCard.jsx'
import LoadingState from '../components/LoadingState.jsx'

export default function Overview({ playerId = 1 }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    api.overview(playerId)
      .then((payload) => {
        if (mounted) setData(payload)
      })
      .catch((loadError) => {
        if (mounted) setError(loadError.message)
      })

    return () => {
      mounted = false
    }
  }, [playerId])

  if (error) return <LoadingState message={`Could not load overview: ${error}`} />
  if (!data) return <LoadingState />

  const totals = data.totals
  const last = data.last_match || {}
  const averageScore = Number(totals.average_score || 0)
  const improvement = last.score ? Math.round(((last.score - averageScore) / Math.max(averageScore, 1)) * 100) : 0
  const scorePerMin = last.duration_seconds ? Math.round(last.score / (last.duration_seconds / 60)) : 0

  return (
    <div className="page">
      <div className="page-heading">
        <h2>Overview</h2>
        <p>Real-time performance summary from Unity match telemetry.</p>
      </div>

      <div className="stat-grid four">
        <StatCard label="Accuracy" value={`${totals.average_accuracy}%`} detail="average across matches" />
        <StatCard label="Damage Dealt" value={compactNumber(totals.total_damage_dealt)} detail="career total" />
        <StatCard label="Enemies Killed" value={totals.total_kills} detail={`${totals.total_matches} matches`} />
        <StatCard label="Most Used Weapon" value={data.most_used_weapon} detail="by usage time" />
      </div>

      <ChartCard title="Performance Comparison" subtitle="Last match score compared with this player's average score" className="large-chart">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data.performance_comparison}>
            <CartesianGrid stroke="#242424" strokeDasharray="4 4" />
            <XAxis dataKey="label" stroke="#8b949e" />
            <YAxis stroke="#8b949e" />
            <Tooltip contentStyle={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 10 }} />
            <Legend />
            <Line
              type="monotone"
              dataKey="last_match_score"
              name="Last Match"
              stroke="#00ff88"
              strokeWidth={3}
              dot={{ r: 4, fill: '#00ff88' }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="average_score"
              name="Average"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ r: 4, fill: '#3b82f6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="bottom-grid">
        <ChartCard title="Improvement" subtitle="Latest match trend">
          <div className="big-number positive">{improvement >= 0 ? '+' : ''}{improvement}%</div>
          <p className="muted">Compared with your average score.</p>
        </ChartCard>
        <ChartCard title="Peak Score/Min" subtitle="Combat tempo">
          <div className="big-number">{scorePerMin}</div>
          <p className="muted">Score generated per active minute.</p>
        </ChartCard>
        <ChartCard title="Consistency" subtitle="Score stability">
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={data.performance_comparison}>
              <Area type="monotone" dataKey="last_match_score" stroke="#00ff88" fill="#00ff8830" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
