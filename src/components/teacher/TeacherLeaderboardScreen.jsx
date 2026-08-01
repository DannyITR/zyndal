import { useEffect, useState } from 'react'
import { getTeacherClasses, getTeacherLeaderboard } from '../../lib/storage'
import TopBar from '../shared/TopBar'

export default function TeacherLeaderboardScreen({ user, onBack, onLogout, onLogoClick }) {
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
        if (!cancelled) setError("Couldn't load the leaderboard. Please try again.")
      })
    return () => {
      cancelled = true
    }
  }, [classId])

  return (
    <div className="screen">
      <TopBar
        title="🏆 Leaderboard"
        subtitle="All students, ranked by XP"
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      <div className="homework-bank-filters">
        <select value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">All Classes</option>
          {(classes || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}
      {!error && !rows && <p className="loading-text">Loading leaderboard…</p>}
      {rows && rows.length === 0 && <p className="loading-text">No students yet.</p>}

      {rows && rows.length > 0 && (
        <ol className="leaderboard-list">
          {rows.map((row, i) => (
            <li key={row.userId} className="leaderboard-row">
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
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
