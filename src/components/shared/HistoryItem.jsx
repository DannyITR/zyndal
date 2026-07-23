import { getSubject } from '../../lib/questions'

export default function HistoryItem({ entry, onSelect }) {
  const subject = entry.subjectId ? getSubject(entry.subjectId) : null

  return (
    <li className={`history-item ${entry.correct ? 'history-item--correct' : 'history-item--wrong'}`}>
      <button type="button" className="history-item-row" onClick={() => onSelect(entry)}>
        <span className="history-icon">{entry.correct ? '✓' : '✕'}</span>
        <div className="history-body">
          <p className="history-prompt">
            {subject ? `${subject.icon} ` : ''}
            {entry.prompt}
          </p>
          <p className="history-meta">{entry.date}</p>
        </div>
        <span className="history-reward">
          {entry.coinsEarned > 0 ? `+${entry.coinsEarned}c` : ''}
        </span>
        <span className="history-chevron">›</span>
      </button>
    </li>
  )
}
