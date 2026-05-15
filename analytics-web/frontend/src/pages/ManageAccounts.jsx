import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { api } from '../api/api.js'
import LoadingState from '../components/LoadingState.jsx'

export default function ManageAccounts() {
  const [accounts, setAccounts] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.adminAccounts()
      .then((data) => setAccounts(data.accounts))
      .catch((loadError) => setError(loadError.message))
  }, [])

  async function toggleAccount(account) {
    setError('')
    try {
      const response = await api.updateAccountStatus(account.id, !account.is_banned)
      setAccounts((current) => current.map((item) => (
        item.id === account.id ? response.account : item
      )))
    } catch (updateError) {
      setError(updateError.message)
    }
  }

  async function deleteAccount(account) {
    const confirmed = window.confirm(`Delete account "${account.username}" completely? This cannot be undone.`)
    if (!confirmed) return

    setError('')
    try {
      await api.deleteAccount(account.id)
      setAccounts((current) => current.filter((item) => item.id !== account.id))
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  if (!accounts && !error) return <LoadingState />

  return (
    <div className="page">
      <div className="page-heading">
        <h2>Manage Accounts</h2>
        <p>Admin-only controls for account access.</p>
      </div>

      {error && <p className="login-error">{error}</p>}

      <section className="table-card manage-table">
        <h3><ShieldCheck size={18} /> Player Accounts</h3>
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Type</th>
              <th>Status</th>
              <th>Action</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {(accounts || []).map((account) => (
              <tr key={account.id}>
                <td>{account.username}</td>
                <td>{account.role}</td>
                <td><span className={`pill ${account.is_banned ? 'defeat' : ''}`}>{account.status}</span></td>
                <td>
                  <button className="small-action-button" type="button" onClick={() => toggleAccount(account)}>
                    {account.is_banned ? 'Unban' : 'Ban'}
                  </button>
                </td>
                <td>
                  <button className="small-action-button delete-action-button" type="button" onClick={() => deleteAccount(account)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
