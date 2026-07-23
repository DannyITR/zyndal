import HistoryItem from './HistoryItem'

export default function HistoryList({ history, limit = 10, emptyText = 'No questions answered yet.', onSelectEntry }) {
  const items = [...history].reverse().slice(0, limit)

  if (items.length === 0) {
    return <p className="history-empty">{emptyText}</p>
  }

  return (
    <ul className="history-list">
      {items.map((entry, i) => (
        <HistoryItem key={entry.id ?? `${entry.date}-${entry.subjectId}-${i}`} entry={entry} onSelect={onSelectEntry} />
      ))}
    </ul>
  )
}
