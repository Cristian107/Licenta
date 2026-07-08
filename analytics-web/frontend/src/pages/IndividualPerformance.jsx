import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { api, formatDuration } from '../api/api.js'
import ChartCard from '../components/ChartCard.jsx'
import LoadingState from '../components/LoadingState.jsx'
import StatCard from '../components/StatCard.jsx'

const COLORS = ['#00ff88', '#3b82f6', '#facc15', '#ef4444', '#a855f7', '#14b8a6']

export default function IndividualPerformance({ playerId = 1 }) {
  const { matchId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        setError(null)
        setData(null)
        let id = matchId
        if (!id) {
          const history = await api.matchHistory(playerId)
          id = history.matches?.[0]?.id
        }

        if (!id) {
          throw new Error('No matches found')
        }

        const performance = await api.individualPerformance(playerId, id)
        if (mounted) setData(performance)
      } catch (loadError) {
        if (mounted) setError(loadError.message)
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [matchId, playerId])

  if (error) return <LoadingState message={`Could not load match journal: ${error}`} />
  if (!data) return <LoadingState />

  const match = data.match
  const deaths = match.result === 'Defeat' ? 1 : 0
  const usageData = data.weapon_stats.map((weapon) => ({
    name: weapon.weapon_name,
    value: weapon.usage_percent,
    kills: weapon.kills
  }))
  const hasWeaponUsage = usageData.some((weapon) => Number(weapon.value || 0) > 0)

  return (
    <div className="page individual-page">
      <div className="page-heading compact">
        <h2>Individual Performance</h2>
        <p>Detailed analysis of Match #{match.id} - {match.level_name}</p>
      </div>

      <div className="stat-grid six">
        <StatCard label="Result" value={match.result} detail="round outcome" tone={match.result === 'Victory' ? 'green' : 'red'} />
        <StatCard label="Score" value={match.score} detail="+5 per kill, crystal, coin" />
        <StatCard label="K/D" value={`${match.enemies_killed} / ${deaths}`} detail="kills / deaths" />
        <StatCard label="Accuracy" value={`${match.accuracy}%`} detail={`${match.shots_hit}/${match.shots_fired} shots`} />
        <StatCard label="Duration" value={formatDuration(match.duration_seconds)} detail={match.level_name} />
        <StatCard label="Kills/Min" value={match.kills_per_min} detail="combat pace" />
      </div>

      <div className="chart-grid two">
        <ChartCard title="Kills Distribution" subtitle="Kills by 30 second interval">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.kill_distribution}>
              <CartesianGrid stroke="#222" strokeDasharray="4 4" />
              <XAxis dataKey="interval" stroke="#9ca3af" interval={0} angle={-28} textAnchor="end" height={58} tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="kills" radius={[8, 8, 0, 0]} fill="#00ff88" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Weapon Usage" subtitle="Share of weapon activity">
          {hasWeaponUsage ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={usageData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={4}>
                  {usageData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend verticalAlign="bottom" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">No weapon usage data for this match.</div>
          )}
        </ChartCard>
      </div>

      <div className="chart-grid two">
        <ChartCard title="Accuracy Progression" subtitle="Estimated accuracy trend through the match">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.accuracy_progression}>
              <CartesianGrid stroke="#222" strokeDasharray="4 4" />
              <XAxis dataKey="time" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="accuracy" stroke="#00ff88" strokeWidth={3} dot={{ fill: '#00ff88', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Performance Metrics" subtitle="Balanced tactical profile">
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={data.performance_metrics}>
              <PolarGrid stroke="#2a2a2a" />
              <PolarAngleAxis dataKey="metric" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Radar dataKey="value" stroke="#00ff88" fill="#00ff88" fillOpacity={0.28} />
              <Tooltip contentStyle={tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="table-card">
        <h3>Weapon Performance Details</h3>
        <table>
          <thead>
            <tr>
              <th>Weapon</th>
              <th>Usage %</th>
              <th>Kills</th>
              <th>Efficiency</th>
            </tr>
          </thead>
          <tbody>
            {data.weapon_stats.map((weapon) => (
              <tr key={weapon.id}>
                <td>{weapon.weapon_name}</td>
                <td>{weapon.usage_percent}%</td>
                <td>{weapon.kills}</td>
                <td>
                  <div className="efficiency-cell">
                    <span>{Math.round(weapon.efficiency)}%</span>
                    <div className="progress-line"><i style={{ width: `${Math.min(weapon.efficiency, 100)}%` }} /></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

const tooltipStyle = {
  background: '#101010',
  border: '1px solid #2a2a2a',
  borderRadius: 10,
  color: '#fff'
}
