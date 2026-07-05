import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export function AdminDashboardPage() {
  const { session, logout } = useAuth()
  const [medicines, setMedicines] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const displayEmail = session?.user?.email ?? 'Admin'

  const loadMedicines = async () => {
    const { data } = await supabase.from('medicines').select('*')
    if (data) setMedicines(data)
    setLoading(false)
  }

  useEffect(() => { loadMedicines() }, [])

  const filtered = medicines.filter(m =>
    m.name.toLowerCase().includes(query.toLowerCase())
  )

  const handleAdd = async (values) => {
    await supabase.from('medicines').insert(values).select()
    await loadMedicines()
  }

  const handleEdit = async (values) => {
    await supabase.from('medicines').update(values).eq('id', editTarget.id)
    await loadMedicines()
    setEditTarget(null)
  }

  const handleDelete = async () => {
    await supabase.from('medicines').delete().eq('id', deleteTarget.id)
    await loadMedicines()
    setDeleteTarget(null)
  }

  return (
    <div>
      <p>TODO: Admin Dashboard UI</p>
    </div>
  )
}
