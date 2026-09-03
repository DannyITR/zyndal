import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getTeacherClassRoster } from '../../lib/storage'
import { getErrorMessage } from '../../lib/errors'
import TopBar from '../shared/TopBar'

function csvEscape(value) {
  const str = String(value ?? '')
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

// Client-side sort (the whole roster is already loaded — a class-sized
// list, no pagination needed) and client-side CSV export (the data's
// already fetched, so no server round trip) — mirrors SettingsScreen.jsx's
// own Blob-download recipe for "Download my data" exactly.
function sortRoster(roster, sortKey, sortDir) {
  const copy = [...roster]
  copy.sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    // Nulls (no grades recorded yet) always sort last, regardless of
    // direction — an "unranked" student shouldn't jump to the top on a
    // descending sort.
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    const an = typeof av === 'boolean' ? (av ? 1 : 0) : av
    const bn = typeof bv === 'boolean' ? (bv ? 1 : 0) : bv
    return sortDir === 'asc' ? an - bn : bn - an
  })
  return copy
}

export default function ClassRosterScreen({ user, classId, onBack, onLogout, onLogoClick }) {
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState('username')
  const [sortDir, setSortDir] = useState('asc')

  useEffect(() => {
    let cancelled = false
    getTeacherClassRoster(classId)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, t, 'teacher.loadRosterFailed'))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId])

  const sortedRoster = useMemo(() => (data ? sortRoster(data.roster, sortKey, sortDir) : null), [data, sortKey, sortDir])

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function handleExportCsv() {
    const headers = [
      t('teacher.rosterColStudent'),
      t('teacher.rosterColStreak'),
      t('teacher.rosterColXp'),
      t('teacher.rosterColDailyQuestion'),
      t('teacher.rosterColHomework'),
      t('teacher.rosterColGrade'),
    ]
    const rows = sortedRoster.map((r) => [
      r.displayName ? `${r.displayName} (@${r.username})` : `@${r.username}`,
      r.currentStreak,
      r.totalXp,
      r.dailyQuestionDoneToday ? '✅' : '—',
      `${r.homeworkCompleted}/${r.homeworkTotal}`,
      r.averageGrade != null ? `${r.averageGrade}%` : '—',
    ])
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${(data?.class?.name || 'class').replace(/[^a-z0-9]+/gi, '-')}-roster.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function SortHeader({ label, sortField }) {
    const active = sortKey === sortField
    return (
      <th className="roster-th" onClick={() => handleSort(sortField)}>
        {label}
        {active && <span className="roster-sort-arrow">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>}
      </th>
    )
  }

  return (
    <div className="screen">
      <TopBar title={t('teacher.rosterTitle')} subtitle={data?.class?.name} username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />

      {error && <p className="form-error">{error}</p>}

      {!data && !error && <p className="loading-text">{t('common.loading')}</p>}

      {data && data.roster.length === 0 && <p className="field-hint">{t('teacher.noStudentsJoined')}</p>}

      {data && data.roster.length > 0 && (
        <>
          <button type="button" className="btn btn-secondary btn-block" onClick={handleExportCsv}>
            {t('teacher.rosterExportCsv')}
          </button>

          <div className="roster-table-wrap">
            <table className="roster-table">
              <thead>
                <tr>
                  <SortHeader label={t('teacher.rosterColStudent')} sortField="username" />
                  <SortHeader label={t('teacher.rosterColStreak')} sortField="currentStreak" />
                  <SortHeader label={t('teacher.rosterColXp')} sortField="totalXp" />
                  <SortHeader label={t('teacher.rosterColDailyQuestion')} sortField="dailyQuestionDoneToday" />
                  <SortHeader label={t('teacher.rosterColHomework')} sortField="homeworkCompleted" />
                  <SortHeader label={t('teacher.rosterColGrade')} sortField="averageGrade" />
                </tr>
              </thead>
              <tbody>
                {sortedRoster.map((r) => (
                  <tr key={r.studentId}>
                    <td>
                      {r.displayName ? `${r.displayName} ` : ''}
                      <span className="roster-username">@{r.username}</span>
                    </td>
                    <td>🔥 {r.currentStreak}</td>
                    <td>⚡ {r.totalXp}</td>
                    <td>{r.dailyQuestionDoneToday ? '✅' : '—'}</td>
                    <td>
                      {r.homeworkCompleted}/{r.homeworkTotal}
                    </td>
                    <td>{r.averageGrade != null ? `${r.averageGrade}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
