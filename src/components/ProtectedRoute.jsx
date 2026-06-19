import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/admin/login" replace />
  return children
}
