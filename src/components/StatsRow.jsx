export function StatsRow({ medicines }) {
  const total = medicines.length
  const inStock = medicines.filter(m => m.quantity > 0).length
  const outOfStock = medicines.filter(m => m.quantity === 0).length

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-blue-600">
        <p className="text-2xl font-bold text-blue-700">{total}</p>
        <p className="text-sm text-gray-500">Total Medicines</p>
      </div>
      <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-green-500">
        <p className="text-2xl font-bold text-green-600">{inStock}</p>
        <p className="text-sm text-gray-500">In Stock</p>
      </div>
      <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-red-500">
        <p className="text-2xl font-bold text-red-600">{outOfStock}</p>
        <p className="text-sm text-gray-500">Out of Stock</p>
      </div>
    </div>
  )
}
