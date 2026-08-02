import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getTeacherClasses, getTeacherLeaderboard } from '../../lib/storage'
import TopBar from '../shared/TopBar'

export default function TeacherLeaderboardScreen({ user, onBack, onLogout, onLogoClick }) {
  const { t } = useTranslation()
  const [classes, setClasses] = useState(null)
  const [classId, setClassId] = useState('')
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getTeacherClasses()
      .then((data) => setClasses(data.classes))
      .catch(() => setClasses([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError('')
    getTeacherLeaderboard(classId || null)
      .then((data) => {
        if (!cancelled) setRows(data.leaderboard)
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
  }, [classId])

  return (
    <div className="screen">
      <TopBar
        title={t('nav.leaderboard')}
        subtitle={t('teacher.leaderboardSubtitle')}
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      <div className="homework-bank-filters">
        <select value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">{t('teacher.allClasses')}</option>
          {(classes || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}
      {!error && !rows && <p className="loading-text">{t('leaderboard.loading')}</p>}
      {rows && rows.length === 0 && <p className="loading-text">{t('leaderboard.noStudentsYet')}</p>}

      {rows && rows.length > 0 && (
        <ol className="leaderboard-list">
          {rows.map((row, i) => (
            <li key={row.userId} className="leaderboard-row">
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
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
