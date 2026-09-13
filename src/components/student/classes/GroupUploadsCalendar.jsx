import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getGroupUploadsCalendar } from '../../../lib/storage'
import { todayStr, formatMonthYear } from '../../../lib/streak'
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

// Structural sibling of HomeworkCalendar.jsx (same nav/grid/legend markup
// and CSS classes), backed by a class's shared uploads instead of a
// class's homework assignments. Works for both an unclaimed group and a
// teacher-claimed class (see classType/classId, mirroring forum_threads'
// own discriminator pair). One real difference from HomeworkCalendar: there's
// no "latest month + 30 days" future window here — a shared upload's day can
// only be today or the past (see UploadCaptureScreen.jsx's day dropdown), so
// the latest browsable month is simply the current one.
export default function GroupUploadsCalendar({ classType, classId, createdAt, onSelectDay }) {
  const { t, i18n } = useTranslation()
  const today = todayStr(new Date(), getUserTimeZone())
  const [todayYear, todayMonth] = today.split('-').map(Number)
  const [viewYear, setViewYear] = useState(todayYear)
  const [viewMonth, setViewMonth] = useState(todayMonth)
  const [uploads, setUploads] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setUploads(null)
    setError('')
    getGroupUploadsCalendar(classType, classId, viewMonth, viewYear)
      .then((data) => {
        if (!cancelled) setUploads(data.uploads)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, t))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classType, classId, viewMonth, viewYear])

  const earliestYearMonth = (createdAt || today).slice(0, 7)
  const latestYearMonth = today.slice(0, 7)
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

  const uploadsByDay = useMemo(() => {
    const map = {}
    for (const u of uploads || []) {
      ;(map[u.sharedForDate] ||= []).push(u)
    }
    return map
  }, [uploads])

  const monthLabel = useMemo(
    () => formatMonthYear(viewYear, viewMonth),
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
          <span className="calendar-legend-dot calendar-legend-dot--assigned" /> {t('groupUploads.legendShared')}
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
      {!uploads && !error && <p className="loading-text">{t('common.loading')}</p>}

      {uploads && (
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
            const dayUploads = uploadsByDay[dateStr] || []

            return (
              <button
                key={dateStr}
                type="button"
                className={`calendar-day homework-calendar-day ${isToday ? 'calendar-day--today' : ''}`}
                onClick={() => onSelectDay(dateStr, dayUploads)}
              >
                {d}
                {dayUploads.length > 0 && <span className="homework-calendar-badge homework-calendar-badge--assigned" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
