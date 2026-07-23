import { useEffect, useState } from 'react'
import { getLeaderboard, getFriendsLeaderboard } from '../../lib/storage'
import TopBar from './TopBar'

export default function Leaderboard({
  highlightUserIds,
  subtitle = 'Top students by XP',
  username,
  currentUserId,
  onBack,
  onLogout,
  onLogoClick,
}) {
  // The Friends tab only makes sense for a logged-in student viewing their
  // own rankings, so it's only offered when currentUserId is provided.
  const [tab, setTab] = useState('global')
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  // Refetches every time this screen is opened, and whenever the tab
  // changes, so ranks and XP are always current.
  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError('')
    const fetcher = tab === 'friends' && currentUserId ? getFriendsLeaderboard(currentUserId) : getLeaderboard()
    fetcher
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the leaderboard. Please try again.")
      })
    return () => {
      cancelled = true
    }
  }, [tab, currentUserId])

  const myIndex = rows ? rows.findIndex((r) => r.userId === currentUserId) : -1
  const myRow = myIndex >= 0 ? rows[myIndex] : null

  return (
    <div className="screen">
      <TopBar
        title="🏆 Leaderboard"
        subtitle={subtitle}
        username={username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      {currentUserId && (
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${tab === 'global' ? 'auth-tab--active' : ''}`}
            onClick={() => setTab('global')}
          >
            Global
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === 'friends' ? 'auth-tab--active' : ''}`}
            onClick={() => setTab('friends')}
          >
            Friends
          </button>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      {!error && !rows && <p className="loading-text">Loading leaderboard…</p>}

      {rows && rows.length === 0 && (
        <p className="loading-text">
          {tab === 'friends' ? 'No friends yet — add some to see them here.' : 'No students yet.'}
        </p>
      )}

      {rows && rows.length > 0 && (
        <ol className="leaderboard-list">
          {rows.map((row, i) => {
            const isAheadOfMe = tab === 'friends' && myRow && i < myIndex && row.userId !== currentUserId
            return (
              <li
                key={row.userId}
                className={`leaderboard-row ${highlightUserIds.has(row.userId) ? 'leaderboard-row--me' : ''}`}
              >
                <div className="leaderboard-row-main">
                  <span className={`leaderboard-rank ${i < 3 ? `leaderboard-rank--${i + 1}` : ''}`}>{i + 1}</span>
                  <div className="leaderboard-info">
                    <p className="leaderboard-username">@{row.username}</p>
                    {row.grade && <p className="leaderboard-grade">Grade {row.grade}</p>}
                  </div>
                  <div className="leaderboard-stats">
                    <span className="leaderboard-streak">🔥 {row.streak}</span>
                    <span className="leaderboard-xp">⚡ {row.xp} XP</span>
                  </div>
                </div>
                {isAheadOfMe && (
                  <p className="leaderboard-nudge">
                    {row.username} is ahead of you by {row.xp - myRow.xp} XP — answer today's questions to catch up
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
