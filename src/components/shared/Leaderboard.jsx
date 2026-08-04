import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getLeaderboard, getFriendsLeaderboard } from '../../lib/storage'
import TopBar from './TopBar'

export default function Leaderboard({
  highlightUserIds,
  subtitle,
  username,
  currentUserId,
  hasCompletedToday,
  onBack,
  onLogout,
  onLogoClick,
}) {
  const { t } = useTranslation()
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
        if (!cancelled) setError(t('leaderboard.loadError'))
      })
    return () => {
      cancelled = true
    }
    // t is a stable function for the app's lifetime (see src/lib/i18n.js) —
    // not a real dependency, and including it would refetch on every
    // language change for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, currentUserId])

  const myIndex = rows ? rows.findIndex((r) => r.userId === currentUserId) : -1
  const myRow = myIndex >= 0 ? rows[myIndex] : null

  return (
    <div className="screen">
      <TopBar
        title={t('nav.leaderboard')}
        subtitle={subtitle || t('leaderboard.defaultSubtitle')}
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
            {t('leaderboard.global')}
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === 'friends' ? 'auth-tab--active' : ''}`}
            onClick={() => setTab('friends')}
          >
            {t('leaderboard.friends')}
          </button>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      {!error && !rows && <p className="loading-text">{t('leaderboard.loading')}</p>}

      {rows && rows.length === 0 && (
        <p className="loading-text">
          {tab === 'friends' ? t('leaderboard.noFriendsYet') : t('leaderboard.noStudentsYet')}
        </p>
      )}

      {rows && rows.length > 0 && (
        <ol className="leaderboard-list">
          {rows.map((row, i) => {
            // Only nudges toward "answer today's questions" when that's
            // actually still true — hasCompletedToday comes from
            // StudentFlow's own dailyProgress (completed + incorrect
            // subjects today, not just correct ones, matching the subject
            // grid and the sharing gate's own definition of "done for the
            // day"), not derived here, so this never depends on stale local
            // state. undefined (the parent-dashboard usage, which has no
            // currentUserId/daily progress at all) never matters in
            // practice: isAheadOfMe already requires myRow, which is always
            // null there since there's no way to reach the friends tab
            // without a currentUserId.
            const isAheadOfMe = tab === 'friends' && myRow && i < myIndex && row.userId !== currentUserId && !hasCompletedToday
            return (
              <li
                key={row.userId}
                className={`leaderboard-row ${highlightUserIds.has(row.userId) ? 'leaderboard-row--me' : ''}`}
              >
                <div className="leaderboard-row-main">
                  <span className={`leaderboard-rank ${i < 3 ? `leaderboard-rank--${i + 1}` : ''}`}>{i + 1}</span>
                  <div className="leaderboard-info">
                    <p className="leaderboard-username">@{row.username}</p>
                    {row.grade && <p className="leaderboard-grade">{t('common.gradeLabel', { grade: row.grade })}</p>}
                  </div>
                  <div className="leaderboard-stats">
                    <span className="leaderboard-streak">🔥 {row.streak}</span>
                    <span className="leaderboard-xp">⚡ {row.xp} XP</span>
                  </div>
                </div>
                {isAheadOfMe && (
                  <p className="leaderboard-nudge">
                    {t('leaderboard.aheadOfYou', { username: row.username, xp: row.xp - myRow.xp })}
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
