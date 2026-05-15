export default function StatCard({ label, value, detail, tone = 'green' }) {
  return (
    <section className={`stat-card ${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      {detail && <span>{detail}</span>}
    </section>
  )
}
