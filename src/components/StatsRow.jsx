export function StatsRow({ medicines }) {
  const total = medicines.length
  const inStock = medicines.filter(m => m.quantity > 0).length
  const outOfStock = medicines.filter(m => m.quantity === 0).length
  const lowStock = medicines.filter(m => m.quantity > 0 && m.quantity <= 10).length

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <StatCard value={total} label="Total Medicines"
        border="border-blue-500" valueColor="text-blue-700"
        iconBg="bg-blue-50" iconColor="text-blue-500" icon={<PillIcon />} />
      <StatCard value={inStock} label="In Stock"
        border="border-green-500" valueColor="text-green-600"
        iconBg="bg-green-50" iconColor="text-green-500" icon={<CheckIcon />} />
      <StatCard value={outOfStock} label="Out of Stock"
        border="border-red-500" valueColor="text-red-600"
        iconBg="bg-red-50" iconColor="text-red-500" icon={<XIcon />} />
      <StatCard value={lowStock} label="Low Stock"
        border="border-amber-500" valueColor="text-amber-600"
        iconBg="bg-amber-50" iconColor="text-amber-500" icon={<AlertIcon />} />
    </div>
  )
}

function StatCard({ value, label, border, valueColor, iconBg, iconColor, icon }) {
  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${border} flex items-center gap-3`}>
      <div className={`w-10 h-10 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <p className={`text-2xl font-bold font-display leading-none ${valueColor}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-1 leading-tight">{label}</p>
      </div>
    </div>
  )
}

// ─── Icons ─────────────────────────────────────────────────────────────────────
function PillIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="M8.5 8.5 15.5 15.5" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}
