export default function WeaponCard({ weapon }) {
  const mastery = Number(weapon.efficiency_share ?? weapon.mastery ?? 0)
  return (
    <div className="weapon-card">
      <div>
        <strong>{weapon.weapon_name}</strong>
        <span>{weapon.kills || 0} kills</span>
      </div>
      <div className="progress-line">
        <i style={{ width: `${Math.min(mastery, 100)}%` }} />
      </div>
      <em>{mastery.toFixed(1).replace('.0', '')}%</em>
    </div>
  )
}
