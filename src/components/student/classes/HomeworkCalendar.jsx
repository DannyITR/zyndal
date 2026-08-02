import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getClassHomeworkCalendar } from '../../../lib/storage'
import { todayStr, addDaysStr, formatMonthYear } from '../../../lib/streak'
import { getUserTimeZone } from '../../../lib/timezone'
import { getErrorMessage } from '../../../lib/errors'

const WEEKDAY_KEYS = [
  'calendar.weekdaySun',
  'calendar.weekdayMon',
  'calendar.weekdayTue',
  'calendar.weekdayWed',
  'calendar.weekdayThu',
  'calendar.weekdayFri',
  'calendar.weekdaySat',
]

function pad(n) {
  return String(n).padStart(2, '0')
}

// A day with a mix of assignments picks one status to badge: any incomplete
// overdue assignment wins (most urgent), then "everything due that day is
// done", otherwise it's just got homework pending.
function statusFor(assignmentsForDay) {
  if (!assignmentsForDay || assignmentsForDay.length === 0) return null
  if (assignmentsForDay.some((a) => a.overdue)) return 'overdue'
  if (assignmentsForDay.every((a) => a.completed)) return 'completed'
  return 'assigned'
}

export default function HomeworkCalendar({ classId, classCreatedAt, onSelectDay }) {
  const { t, i18n } = useTranslation()
  const today = todayStr(new Date(), getUserTimeZone())
  const [todayYear, todayMonth] = today.split('-').map(Number)
  const [viewYear, setViewYear] = useState(todayYear)
  const [viewMonth, setViewMonth] = useState(todayMonth)
  const [assignments, setAssignments] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setAssignments(null)
    setError('')
    getClassHomeworkCalendar(classId, viewMonth, viewYear)
      .then((data) => {
        if (!cancelled) setAssignments(data.assignments)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, t))
      })
    return () => {
      cancelled = true
    }
    // t is a stable function for the app's lifetime (see src/lib/i18n.js) —
    // not a real dependency, and including it would refetch on every
    // language change for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, viewMonth, viewYear])

  const earliestYearMonth = (classCreatedAt || today).slice(0, 7)
  const latestYearMonth = addDaysStr(today, 30).slice(0, 7)
  const viewYearMonth = `${viewYear}-${pad(viewMonth)}`
  const isEarliestMonth = viewYearMonth <= earliestYearMonth
  const isLatestMonth = viewYearMonth >= latestYearMonth

  function goPrevMonth() {
    if (isEarliestMonth) return
    if (viewMonth === 1) {
      setViewYear(viewYear - 1)
      setViewMonth(12)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  function goNextMonth() {
    if (isLatestMonth) return
    if (viewMonth === 12) {
      setViewYear(viewYear + 1)
      setViewMonth(1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const assignmentsByDay = useMemo(() => {
    const map = {}
    for (const a of assignments || []) {
      ;(map[a.dueDate] ||= []).push(a)
    }
    return map
  }, [assignments])

  const monthLabel = useMemo(
    () => formatMonthYear(viewYear, viewMonth),
    // i18n.language isn't referenced directly (formatMonthYear reads it from
    // the i18n singleton internally) but must still be a dependency, or a
    // language switch while this screen is open won't update the label.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewYear, viewMonth, i18n.language]
  )

  const cells = useMemo(() => {
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate()
    const firstWeekday = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay()
    const list = []
    for (let i = 0; i < firstWeekday; i++) list.push(null)
    for (let d = 1; d <= daysInMonth; d++) list.push(d)
    return list
  }, [viewYear, viewMonth])

  return (
    <div className="homework-calendar">
      <div className="calendar-legend">
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot calendar-legend-dot--assigned" /> {t('classes.legendHomework')}
        </span>
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot calendar-legend-dot--hw-completed" /> {t('classes.legendCompleted')}
        </span>
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot calendar-legend-dot--overdue" /> {t('classes.legendOverdue')}
        </span>
      </div>

      <div className="calendar-nav">
        <button type="button" className="calendar-nav-arrow" onClick={goPrevMonth} disabled={isEarliestMonth} aria-label={t('calendar.prevMonth')}>
          ←
        </button>
        <span className="calendar-nav-label">{monthLabel}</span>
        <button type="button" className="calendar-nav-arrow" onClick={goNextMonth} disabled={isLatestMonth} aria-label={t('calendar.nextMonth')}>
          →
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {!assignments && !error && <p className="loading-text">{t('common.loading')}</p>}

      {assignments && (
        <div className="calendar-grid">
          {WEEKDAY_KEYS.map((key, i) => (
            <div key={`label-${i}`} className="calendar-weekday-label">
              {t(key)}
            </div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={`blank-${i}`} className="calendar-day calendar-day--blank" />

            const dateStr = `${viewYear}-${pad(viewMonth)}-${pad(d)}`
            const isToday = dateStr === today
            const dayAssignments = assignmentsByDay[dateStr] || []
            const status = statusFor(dayAssignments)

            return (
              <button
                key={dateStr}
                type="button"
                className={`calendar-day homework-calendar-day ${isToday ? 'calendar-day--today' : ''}`}
                onClick={() => onSelectDay(dateStr, dayAssignments)}
              >
                {d}
                {status === 'completed' && <span className="homework-calendar-badge homework-calendar-badge--completed">✓</span>}
                {status === 'assigned' && <span className="homework-calendar-badge homework-calendar-badge--assigned" />}
                {status === 'overdue' && <span className="homework-calendar-badge homework-calendar-badge--overdue" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
