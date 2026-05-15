import { useState } from 'react'
import { Activity, Lock, User } from 'lucide-react'
import { api } from '../api/api.js'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const auth = await api.login({ username, password })
      onLogin(auth)
    } catch (loginError) {
      setError(loginError.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-mark"><Activity size={22} /></div>
          <div>
            <h1>Explorer's Journal</h1>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Nume utilizator</span>
            <div className="input-shell">
              <User size={18} />
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
            </div>
          </label>

          <label>
            <span>Parola</span>
            <div className="input-shell">
              <Lock size={18} />
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
            </div>
          </label>

          {error && <p className="login-error">{error}</p>}

          <button className="login-button" type="submit" disabled={loading}>
            {loading ? 'Se verifica...' : 'Login'}
          </button>
        </form>
      </section>
    </main>
  )
}
