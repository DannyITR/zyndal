import { useMemo, useState } from 'react'
import TopBar from '../shared/TopBar'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Nothing to show before Zyndal existed — also doubles as the ← bound so a
// student can't navigate into months with no possible data.
const EARLIEST_YEAR_MONTH = '2026-07'

function pad(n) {
  return String(n).padStart(2, '0')
}

// Every color state this screen needs already lives in the already-loaded
// progress.history (see StudentFlow.jsx's getProgress() call) — one entry
// per subject per day ever answered, each with its own .date, .subjectId
// and .correct. No new endpoint needed just to color a month grid. Always
// combines all subjects — a day can genuinely have both a correct and an
// incorrect entry (the "mixed" state below) since different subjects are
// answered independently.
function computeDayStates(history) {
  const map = {}
  for (const entry of history) {
    const state = map[entry.date] || { hasCorrect: false, hasIncorrect: false }
    if (entry.correct) state.hasCorrect = true
    else state.hasIncorrect = true
    map[entry.date] = state
  }
  return map
}

function colorClassFor(state, isFuture) {
  if (isFuture) return 'calendar-day--future'
  if (!state) return 'calendar-day--empty'
  if (state.hasCorrect && state.hasIncorrect) return 'calendar-day--mixed'
  if (state.hasCorrect) return 'calendar-day--correct'
  return 'calendar-day--wrong'
}

export default function CalendarScreen({ user, progress, today, onSelectDay, onBack, onLogout, onLogoClick }) {
  const [todayYear, todayMonth] = today.split('-').map(Number)
  const [viewYear, setViewYear] = useState(todayYear)
  const [viewMonth, setViewMonth] = useState(todayMonth)

  const viewYearMonth = `${viewYear}-${pad(viewMonth)}`
  const todayYearMonth = `${todayYear}-${pad(todayMonth)}`
  const isEarliestMonth = viewYearMonth <= EARLIEST_YEAR_MONTH
  const isLatestMonth = viewYearMonth >= todayYearMonth

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

  const dayStates = useMemo(() => computeDayStates(progress.history), [progress.history])

  const monthLabel = useMemo(
    () =>
      new Date(Date.UTC(viewYear, viewMonth - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    [viewYear, viewMonth]
  )

  const cells = useMemo(() => {
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate()
    const firstWeekday = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay() // 0 = Sunday
    const list = []
    for (let i = 0; i < firstWeekday; i++) list.push(null)
    for (let d = 1; d <= daysInMonth; d++) list.push(d)
    return list
  }, [viewYear, viewMonth])

  return (
    <div className="screen student-screen">
      <TopBar
        title="📅 Calendar"
        subtitle="All subjects"
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      <div className="calendar-legend">
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot calendar-legend-dot--correct" /> Correct
        </span>
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot calendar-legend-dot--mixed" /> Mixed
        </span>
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot calendar-legend-dot--wrong" /> Wrong
        </span>
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot calendar-legend-dot--empty" /> No activity
        </span>
      </div>

      <div className="calendar-nav">
        <button type="button" className="calendar-nav-arrow" onClick={goPrevMonth} disabled={isEarliestMonth} aria-label="Previous month">
          ←
        </button>
        <span className="calendar-nav-label">{monthLabel}</span>
        <button type="button" className="calendar-nav-arrow" onClick={goNextMonth} disabled={isLatestMonth} aria-label="Next month">
          →
        </button>
      </div>

      <div className="calendar-grid">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={`label-${i}`} className="calendar-weekday-label">
            {label}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`blank-${i}`} className="calendar-day calendar-day--blank" />

          const dateStr = `${viewYear}-${pad(viewMonth)}-${pad(d)}`
          const isFuture = dateStr > today
          const isToday = dateStr === today
          const isTappable = !isFuture && !isToday
          const colorClass = colorClassFor(dayStates[dateStr], isFuture)

          return (
            <button
              key={dateStr}
              type="button"
              className={`calendar-day ${colorClass} ${isToday ? 'calendar-day--today' : ''}`}
              disabled={!isTappable}
              onClick={() => isTappable && onSelectDay(dateStr)}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}
