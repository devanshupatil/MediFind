import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'

// ── Icons ─────────────────────────────────────────────────────

function IconPill() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

// ── Login Page ────────────────────────────────────────────────

export function AdminLoginPage() {
  const { login }    = useAuth()
  const navigate     = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await login(email, password)
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      navigate('/admin/dashboard')
    }
  }

  return (
    <div className="adm-login-root">
      {/* Background glow */}
      <div className="adm-login-glow" aria-hidden="true" />

      <motion.div
        className="adm-login-card"
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Logo */}
        <div className="adm-login-logo">
          <div className="sp-logo-icon">
            <IconPill />
          </div>
          <span className="sp-logo-text">MediFind</span>
        </div>

        <div className="adm-login-heading">
          <h1 className="adm-login-title">Admin Portal</h1>
          <p className="adm-login-sub">Sign in to manage your inventory</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="adm-login-form">
          {/* Username */}
          <div className="adm-field">
            <label htmlFor="adm-login-email" className="adm-label">Username</label>
            <div className="adm-input-wrap">
              <span className="adm-input-icon"><IconUser /></span>
              <input
                id="adm-login-email"
                type="email"
                className="adm-input adm-input--icon"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="admin@medifind.com"
                autoComplete="username"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="adm-field">
            <label htmlFor="adm-login-password" className="adm-label">Password</label>
            <div className="adm-input-wrap">
              <span className="adm-input-icon"><IconLock /></span>
              <input
                id="adm-login-password"
                type="password"
                className="adm-input adm-input--icon"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <motion.p
              className="adm-login-error"
              role="alert"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            className="adm-btn adm-btn-primary adm-btn--full"
            disabled={loading}
            aria-label="Login"
          >
            {loading ? (
              <span className="adm-spinner" aria-hidden="true" />
            ) : 'Sign in'}
          </button>
        </form>

        <p className="adm-login-back">
          <a href="/" className="adm-login-back-link">← Back to search</a>
        </p>
      </motion.div>
    </div>
  )
}
