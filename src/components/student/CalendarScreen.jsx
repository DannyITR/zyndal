import { useMemo } from 'react'
import TopBar from '../shared/TopBar'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function pad(n) {
  return String(n).padStart(2, '0')
}

// Every color state this screen needs already lives in the already-loaded
// progress.history (see StudentFlow.jsx's getProgress() call) — one entry
// per subject per day ever answered, each with its own .date and .correct.
// No new endpoint needed just to color a month grid.
function computeDayStates(history) {
  const map = {}
  for (const entry of history) {
    const state = map[entry.date] || { hasAny: false, hasCorrect: false }
    state.hasAny = true
    if (entry.correct) state.hasCorrect = true
    map[entry.date] = state
  }
  return map
}

export default function CalendarScreen({ user, progress, today, onSelectDay, onBack, onLogout, onLogoClick }) {
  const [year, month] = today.split('-').map(Number)

  const dayStates = useMemo(() => computeDayStates(progress.history), [progress.history])

  const monthLabel = useMemo(
    () => new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    [year, month]
  )

  const cells = useMemo(() => {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay() // 0 = Sunday
    const list = []
    for (let i = 0; i < firstWeekday; i++) list.push(null)
    for (let d = 1; d <= daysInMonth; d++) list.push(d)
    return list
  }, [year, month])

  return (
    <div className="screen student-screen">
      <TopBar title="📅 Calendar" subtitle={monthLabel} username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />

      <div className="calendar-legend">
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot calendar-legend-dot--correct" /> Correct
        </span>
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot calendar-legend-dot--wrong" /> Wrong
        </span>
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot calendar-legend-dot--empty" /> No activity
        </span>
      </div>

      <div className="calendar-grid">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={`label-${i}`} className="calendar-weekday-label">
            {label}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`blank-${i}`} className="calendar-day calendar-day--blank" />

          const dateStr = `${year}-${pad(month)}-${pad(d)}`
          const isFuture = dateStr > today
          const isToday = dateStr === today
          const isTappable = !isFuture && !isToday
          const state = dayStates[dateStr]

          let colorClass = 'calendar-day--empty'
          if (isFuture) colorClass = 'calendar-day--future'
          else if (state?.hasCorrect) colorClass = 'calendar-day--correct'
          else if (state?.hasAny) colorClass = 'calendar-day--wrong'

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
