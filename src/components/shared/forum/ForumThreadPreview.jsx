import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getForumThreads } from '../../../lib/storage'

// Self-contained widget embedded in ClassCard.jsx, same pattern as
// HomeworkCalendar.jsx — fetches its own data on mount rather than making
// ClassCard orchestrate it. Reuses api/forum/get-threads.js as-is (already
// sorted by last activity descending) and just takes the first 3; no new
// endpoint needed for a preview of data that endpoint already returns in
// full.
export default function ForumThreadPreview({ classType, classId, onSelectThread }) {
  const { t } = useTranslation()
  const [threads, setThreads] = useState(null)

  useEffect(() => {
    let cancelled = false
    getForumThreads(classType, classId)
      .then((data) => {
        if (!cancelled) setThreads(data.threads)
      })
      .catch(() => {
        // Best-effort preview — a failed fetch just hides the widget
        // instead of showing an error on what's otherwise a working page.
        if (!cancelled) setThreads([])
      })
    return () => {
      cancelled = true
    }
  }, [classType, classId])

  if (threads === null) return null

  const preview = threads.slice(0, 3)

  return (
    <div className="forum-preview">
      <h3 className="section-heading">{t('forum.title')}</h3>
      {preview.length === 0 ? (
        <p className="field-hint">{t('forum.noThreadsYet')}</p>
      ) : (
        <div className="forum-preview-list">
          {preview.map((thread) => (
            <button key={thread.id} type="button" className="forum-preview-row" onClick={() => onSelectThread(thread.id)}>
              <span className="forum-preview-title">{thread.title}</span>
              <span className="forum-preview-count">{t('forum.repliesCount', { count: thread.replyCount })}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
