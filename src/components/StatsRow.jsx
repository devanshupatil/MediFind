/**
 * StatsRow — Four stat cards displayed at the top of the admin dashboard.
 * Counts: total, inStock (qty > 5), lowStock (0 < qty <= 5), outOfStock (qty === 0)
 */

// Low-stock threshold: > 0 and <= 10
const LOW_STOCK_MAX = 10

function StatCard({ label, value, colorClass, icon }) {
  return (
    <div className={`adm-stat-card ${colorClass}`}>
      <div className="adm-stat-icon">{icon}</div>
      <div className="adm-stat-body">
        <span className="adm-stat-value">{value}</span>
        <span className="adm-stat-label">{label}</span>
      </div>
    </div>
  )
}

export function StatsRow({ medicines }) {
  const total      = medicines.length
  const inStock    = medicines.filter(m => (m.quantity ?? 0) > 0).length
  const lowStock   = medicines.filter(m => (m.quantity ?? 0) > 0 && (m.quantity ?? 0) <= LOW_STOCK_MAX).length
  const outOfStock = medicines.filter(m => (m.quantity ?? 0) === 0).length

  return (
    <div className="adm-stats-row">
      <StatCard
        label="Total Medicines"
        value={total}
        colorClass="adm-stat--blue"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
            <path d="m8.5 8.5 7 7" />
          </svg>
        }
      />
      <StatCard
        label="In Stock"
        value={inStock}
        colorClass="adm-stat--green"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        }
      />
      <StatCard
        label="Low Stock"
        value={lowStock}
        colorClass="adm-stat--amber"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        }
      />
      <StatCard
        label="Out of Stock"
        value={outOfStock}
        colorClass="adm-stat--red"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        }
      />
    </div>
  )
}
