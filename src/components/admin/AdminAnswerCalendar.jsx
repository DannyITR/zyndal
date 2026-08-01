import { useMemo, useState } from 'react'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
// Matches CalendarScreen.jsx's own EARLIEST_YEAR_MONTH — nothing to show
// before Zyndal existed, for any student.
const EARLIEST_YEAR_MONTH = '2026-07'

function pad(n) {
  return String(n).padStart(2, '0')
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Mirrors CalendarScreen.jsx's computeDayStates/colorClassFor — same
// algorithm (one history entry per subject per day, a day can be "mixed"
// if different subjects went differently), just re-themed for the admin
// panel's light background instead of reusing that component directly
// (which hardcodes the dark student app's TopBar/screen chrome).
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
  if (isFuture) return 'admin-calendar-day--future'
  if (!state) return 'admin-calendar-day--empty'
  if (state.hasCorrect && state.hasIncorrect) return 'admin-calendar-day--mixed'
  if (state.hasCorrect) return 'admin-calendar-day--correct'
  return 'admin-calendar-day--wrong'
}

export default function AdminAnswerCalendar({ history }) {
  const today = todayStr()
  const [todayYear, todayMonth] = today.split('-').map(Number)
  const [viewYear, setViewYear] = useState(todayYear)
  const [viewMonth, setViewMonth] = useState(todayMonth)
  const [selectedDay, setSelectedDay] = useState(null)

  const viewYearMonth = `${viewYear}-${pad(viewMonth)}`
  const todayYearMonth = `${todayYear}-${pad(todayMonth)}`
  const isEarliestMonth = viewYearMonth <= EARLIEST_YEAR_MONTH
  const isLatestMonth = viewYearMonth >= todayYearMonth

  function goPrevMonth() {
    if (isEarliestMonth) return
    setSelectedDay(null)
    if (viewMonth === 1) {
      setViewYear(viewYear - 1)
      setViewMonth(12)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  function goNextMonth() {
    if (isLatestMonth) return
    setSelectedDay(null)
    if (viewMonth === 12) {
      setViewYear(viewYear + 1)
      setViewMonth(1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const dayStates = useMemo(() => computeDayStates(history), [history])

  const monthLabel = useMemo(
    () => new Date(Date.UTC(viewYear, viewMonth - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    [viewYear, viewMonth]
  )

  const cells = useMemo(() => {
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate()
    const firstWeekday = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay()
    const list = []
    for (let i = 0; i < firstWeekday; i++) list.push(null)
    for (let d = 1; d <= daysInMonth; d++) list.push(d)
    return list
  }, [viewYear, viewMonth])

  const selectedDayEntries = selectedDay ? history.filter((h) => h.date === selectedDay) : []

  return (
    <div>
      <div className="admin-calendar-legend">
        <span className="admin-calendar-legend-item">
          <span className="admin-calendar-legend-dot admin-calendar-legend-dot--correct" /> Correct
        </span>
        <span className="admin-calendar-legend-item">
          <span className="admin-calendar-legend-dot admin-calendar-legend-dot--mixed" /> Mixed
        </span>
        <span className="admin-calendar-legend-item">
          <span className="admin-calendar-legend-dot admin-calendar-legend-dot--wrong" /> Wrong
        </span>
        <span className="admin-calendar-legend-item">
          <span className="admin-calendar-legend-dot admin-calendar-legend-dot--empty" /> No activity
        </span>
      </div>

      <div className="admin-calendar-nav">
        <button type="button" className="admin-btn admin-btn-small" onClick={goPrevMonth} disabled={isEarliestMonth} aria-label="Previous month">
          ←
        </button>
        <span>{monthLabel}</span>
        <button type="button" className="admin-btn admin-btn-small" onClick={goNextMonth} disabled={isLatestMonth} aria-label="Next month">
          →
        </button>
      </div>

      <div className="admin-calendar-grid">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={`label-${i}`} className="admin-calendar-weekday-label">
            {label}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`blank-${i}`} className="admin-calendar-day admin-calendar-day--blank" />

          const dateStr = `${viewYear}-${pad(viewMonth)}-${pad(d)}`
          const isFuture = dateStr > today
          const isTappable = !isFuture && dayStates[dateStr]
          const colorClass = colorClassFor(dayStates[dateStr], isFuture)

          return (
            <button
              key={dateStr}
              type="button"
              className={`admin-calendar-day ${colorClass} ${dateStr === today ? 'admin-calendar-day--today' : ''} ${dateStr === selectedDay ? 'admin-calendar-day--selected' : ''}`}
              disabled={!isTappable}
              onClick={() => setSelectedDay(dateStr)}
            >
              {d}
            </button>
          )
        })}
      </div>

      {selectedDay && (
        <div className="admin-calendar-day-detail">
          <h4>{selectedDay}</h4>
          {selectedDayEntries.length === 0 ? (
            <p className="admin-empty-hint">No answers this day.</p>
          ) : (
            <div className="admin-scroll-list">
              {selectedDayEntries.map((entry) => (
                <div className="admin-list-row admin-list-row--wrap" key={entry.id}>
                  <span className="admin-calendar-day-detail-subject">{entry.subjectId}</span>
                  <span className="admin-calendar-day-detail-question">{entry.prompt}</span>
                  <span className={entry.correct ? 'admin-text-good' : 'admin-text-bad'}>
                    Answered: {entry.selectedAnswer ?? '—'}
                  </span>
                  {!entry.correct && <span className="admin-text-good">Correct: {entry.correctAnswer ?? '—'}</span>}
                  <span>{entry.correct ? '✓ Correct' : '✕ Incorrect'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
