import { useEffect, useState } from 'react'
import { getAdminStats, getAdminUsers, updateAdminUser, deleteAdminUser } from '../../lib/adminApi'
import AdminConfirmDeleteModal from './AdminConfirmDeleteModal'

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

const RELATIVE_UNITS = [
  { limit: 60, divisor: 1, label: 'second' },
  { limit: 3600, divisor: 60, label: 'minute' },
  { limit: 86400, divisor: 3600, label: 'hour' },
  { limit: 604800, divisor: 86400, label: 'day' },
  { limit: 2629800, divisor: 604800, label: 'week' },
  { limit: 31557600, divisor: 2629800, label: 'month' },
  { limit: Infinity, divisor: 31557600, label: 'year' },
]

// last_active_at (see api/admin/get-users.js) is the GREATEST of a user's
// last_login_at and last_activity_at — this just renders it relatively,
// no "which of the two was more recent" logic lives here.
function formatRelativeTime(value) {
  if (!value) return 'Never'
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000)
  if (seconds < 30) return 'Just now'
  const unit = RELATIVE_UNITS.find((u) => seconds < u.limit)
  const amount = Math.round(seconds / unit.divisor)
  return `${amount} ${unit.label}${amount === 1 ? '' : 's'} ago`
}

// subscription_status/days_remaining_in_trial come pre-computed from
// api/_lib/subscription.js (see api/admin/get-users.js) — this just
// renders the label, no status logic lives here.
function formatSubscriptionStatus(user) {
  switch (user.subscription_status) {
    case 'trial_active':
      return `Trial (${user.days_remaining_in_trial} day${user.days_remaining_in_trial === 1 ? '' : 's'} left)`
    case 'premium':
      return 'Premium'
    case 'trial_expired':
      return 'Expired'
    default:
      return 'Free'
  }
}

const STAT_CARDS = [
  { key: 'totalUsers', label: 'Total Users', get: (s) => s.totalUsers.all },
  { key: 'activeToday', label: 'Active Today', get: (s) => s.dailyActiveUsers },
  { key: 'newThisWeek', label: 'New This Week', get: (s) => s.newSignups.week },
  { key: 'premiumUsers', label: 'Premium Users', get: (s) => s.premiumUsers },
  { key: 'questionsToday', label: 'Questions Answered Today', get: (s) => s.questionsAnsweredToday },
]

export default function AdminDashboard({ onLogout, onEditUser, refreshKey }) {
  const [stats, setStats] = useState(null)
  const [statsError, setStatsError] = useState('')

  const [users, setUsers] = useState(null)
  const [usersError, setUsersError] = useState('')
  const [usersLoading, setUsersLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [accountType, setAccountType] = useState('')
  const [isPremium, setIsPremium] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  const [busyUserId, setBusyUserId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null) // { id, username, hardDelete }
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch((err) => setStatsError(err.message || 'Failed to load stats.'))
  }, [])

  function refreshStats() {
    getAdminStats()
      .then(setStats)
      .catch(() => {})
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, accountType, isPremium, sortBy, sortDir])

  function handleSortClick(column) {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortDir('desc')
    }
  }

  function sortIndicator(column) {
    if (sortBy !== column) return null
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  useEffect(() => {
    let cancelled = false
    setUsersLoading(true)
    setUsersError('')
    getAdminUsers({ page, limit, search: debouncedSearch, accountType, isPremium, sortBy, sortDir })
      .then((data) => {
        if (cancelled) return
        setUsers(data.users)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      })
      .catch((err) => {
        if (cancelled) return
        setUsersError(err.message || 'Failed to load users.')
        setUsers([])
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false)
      })
    return () => {
      cancelled = true
    }
    // refreshKey is a pure "refetch" signal AdminApp bumps whenever the
    // admin returns from the Edit User page, since a save there (premium
    // status, deleted_at, username, ...) could have changed something this
    // table shows. AdminDashboard is kept mounted (not unmounted) while
    // that page is open specifically so page/search/filter state survives
    // the round trip — see AdminApp.jsx.
  }, [page, limit, debouncedSearch, accountType, isPremium, sortBy, sortDir, refreshKey])

  async function handleTogglePremium(user) {
    setActionError('')
    setBusyUserId(user.id)
    try {
      await updateAdminUser({ user_id: user.id, is_premium: !user.is_premium })
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_premium: !u.is_premium } : u)))
      refreshStats()
    } catch (err) {
      setActionError(err.message || 'Failed to update user.')
    } finally {
      setBusyUserId(null)
    }
  }

  async function handleRestore(user) {
    setActionError('')
    setBusyUserId(user.id)
    try {
      await updateAdminUser({ user_id: user.id, deleted_at: null })
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, deleted_at: null } : u)))
      refreshStats()
    } catch (err) {
      setActionError(err.message || 'Failed to restore user.')
    } finally {
      setBusyUserId(null)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setActionError('')
    setBusyUserId(deleteTarget.id)
    try {
      await deleteAdminUser({ user_id: deleteTarget.id, hard_delete: deleteTarget.hardDelete, confirm: 'DELETE' })
      if (deleteTarget.hardDelete) {
        setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id))
      } else {
        setUsers((prev) => prev.map((u) => (u.id === deleteTarget.id ? { ...u, deleted_at: new Date().toISOString() } : u)))
      }
      setDeleteTarget(null)
      refreshStats()
    } catch (err) {
      setActionError(err.message || 'Failed to delete user.')
      setDeleteTarget(null)
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Zyndal Admin</h1>
        <button type="button" className="admin-btn admin-btn-secondary" onClick={onLogout}>
          Log Out
        </button>
      </header>

      <section className="admin-stats-grid">
        {statsError && <p className="admin-error">{statsError}</p>}
        {!statsError &&
          STAT_CARDS.map((card) => (
            <div className="admin-stat-card" key={card.key}>
              <p className="admin-stat-value">{stats ? card.get(stats) : '…'}</p>
              <p className="admin-stat-label">{card.label}</p>
            </div>
          ))}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Users</h2>
          <div className="admin-filters">
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search username or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select value={accountType} onChange={(e) => setAccountType(e.target.value)}>
              <option value="">All Types</option>
              <option value="student">Student</option>
              <option value="parent">Parent</option>
              <option value="teacher">Teacher</option>
            </select>
            <select value={isPremium} onChange={(e) => setIsPremium(e.target.value)}>
              <option value="">All Users</option>
              <option value="true">Premium Only</option>
              <option value="false">Non-Premium</option>
            </select>
          </div>
        </div>

        {actionError && <p className="admin-error">{actionError}</p>}
        {usersError && <p className="admin-error">{usersError}</p>}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Type</th>
                <th>Grade</th>
                <th>Subscription</th>
                <th>Verified</th>
                <th>Streak</th>
                <th>XP</th>
                <th className="admin-th-sortable" onClick={() => handleSortClick('created_at')}>
                  Joined{sortIndicator('created_at')}
                </th>
                <th className="admin-th-sortable" onClick={() => handleSortClick('last_active_at')}>
                  Last Active{sortIndicator('last_active_at')}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersLoading && (
                <tr>
                  <td colSpan={11} className="admin-table-empty">
                    Loading…
                  </td>
                </tr>
              )}
              {!usersLoading && users && users.length === 0 && (
                <tr>
                  <td colSpan={11} className="admin-table-empty">
                    No users found.
                  </td>
                </tr>
              )}
              {!usersLoading &&
                users?.map((user) => (
                  <tr key={user.id} className={user.deleted_at ? 'admin-row-deleted' : ''}>
                    <td>@{user.username}</td>
                    <td>{user.email || '—'}</td>
                    <td>{user.account_type}</td>
                    <td>{user.grade ?? '—'}</td>
                    <td>{formatSubscriptionStatus(user)}</td>
                    <td>{user.email_verified ? 'Yes' : 'No'}</td>
                    <td>{user.current_streak}</td>
                    <td>{user.total_xp}</td>
                    <td>{formatDate(user.created_at)}</td>
                    <td>{formatRelativeTime(user.last_active_at)}</td>
                    <td className="admin-row-actions">
                      <button type="button" className="admin-btn admin-btn-small" onClick={() => onEditUser(user.id)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-small"
                        disabled={busyUserId === user.id}
                        onClick={() => handleTogglePremium(user)}
                      >
                        {user.is_premium ? 'Unset Premium' : 'Make Premium'}
                      </button>
                      {user.deleted_at ? (
                        <>
                          <button
                            type="button"
                            className="admin-btn admin-btn-small admin-btn-danger"
                            disabled={busyUserId === user.id}
                            onClick={() => handleRestore(user)}
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-small admin-btn-danger"
                            disabled={busyUserId === user.id}
                            onClick={() => setDeleteTarget({ id: user.id, username: user.username, hardDelete: true })}
                          >
                            Hard Delete
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="admin-btn admin-btn-small admin-btn-danger"
                          disabled={busyUserId === user.id}
                          onClick={() => setDeleteTarget({ id: user.id, username: user.username, hardDelete: false })}
                        >
                          Soft Delete
                        </button>
                      )}
                    </td>
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
            Page {page} of {totalPages} ({total} users)
          </span>
          <button type="button" className="admin-btn admin-btn-small" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </section>

      {deleteTarget && (
        <AdminConfirmDeleteModal
          username={deleteTarget.username}
          hardDelete={deleteTarget.hardDelete}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  )
}
