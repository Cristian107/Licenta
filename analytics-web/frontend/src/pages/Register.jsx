import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Lock, User } from 'lucide-react'
import { api } from '../api/api.js'

export default function Register({ onRegister }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const auth = await api.register({
        username,
        password,
        confirm_password: confirmPassword
      })
      onRegister(auth)
    } catch (registerError) {
      setError(registerError.message || 'Register failed')
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
            <h1>Create Account</h1>
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
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
            </div>
          </label>

          <label>
            <span>Confirma parola</span>
            <div className="input-shell">
              <Lock size={18} />
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
            </div>
          </label>

          {error && <p className="login-error">{error}</p>}

          <button className="login-button" type="submit" disabled={loading}>
            {loading ? 'Se creeaza...' : 'Create Account'}
          </button>
          <Link className="secondary-auth-button" to="/">
            Back to Login
          </Link>
        </form>
      </section>
    </main>
  )
}
