import { useEffect, useState } from 'react'
import { getAdminMessages } from '../../lib/adminApi'

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

// Full browse/search visibility into every private message on the
// platform — unlike the forum's report-only admin queue, the spec calls
// for admin to see all DMs regardless of whether anyone reported them.
// Mirrors AdminDashboard.jsx's own user table (search + pagination) for
// the same reason it uses api/admin/get-users.js's shape.
export default function AdminMessagesScreen({ onBack, onLogout }) {
  const [messages, setMessages] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  useEffect(() => {
    setMessages(null)
    getAdminMessages({ page, limit, search: debouncedSearch })
      .then((data) => {
        setMessages(data.messages)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      })
      .catch((err) => setLoadError(err.message || 'Failed to load messages.'))
  }, [page, limit, debouncedSearch])

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <button type="button" className="admin-back-link" onClick={onBack}>
            ← Back to Dashboard
          </button>
          <h1>Private Messages</h1>
        </div>
        <button type="button" className="admin-btn admin-btn-secondary" onClick={onLogout}>
          Log Out
        </button>
      </header>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>All Messages</h2>
          <div className="admin-filters">
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search by sender or recipient username…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loadError && <p className="admin-error">{loadError}</p>}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Sender</th>
                <th>Recipient</th>
                <th>Message</th>
                <th>Sent</th>
                <th>Read</th>
              </tr>
            </thead>
            <tbody>
              {messages === null && !loadError && (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    Loading…
                  </td>
                </tr>
              )}
              {messages && messages.length === 0 && (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    No messages found.
                  </td>
                </tr>
              )}
              {messages?.map((m) => (
                <tr key={m.id}>
                  <td>@{m.senderUsername}</td>
                  <td>@{m.recipientUsername}</td>
                  <td>{m.body}</td>
                  <td>{formatDateTime(m.createdAt)}</td>
                  <td>{m.readAt ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-pagination">
          <button type="button" className="admin-btn admin-btn-small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {totalPages} ({total} messages)
          </span>
          <button type="button" className="admin-btn admin-btn-small" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </section>
    </div>
  )
}
