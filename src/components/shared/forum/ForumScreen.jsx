import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getForumThreads, getForumThread, createForumReply } from '../../../lib/storage'
import { getErrorMessage } from '../../../lib/errors'
import { LOCALE_FOR_LANGUAGE } from '../../../lib/i18n'
import TopBar from '../TopBar'
import NewThreadModal from './NewThreadModal'
import ReportContentModal from './ReportContentModal'

function formatDateTime(value, language) {
  return new Date(value).toLocaleString(LOCALE_FOR_LANGUAGE[language] || 'en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

// Role-agnostic — a student (via ClassCard.jsx's Forum section) and a
// teacher (via ClassDetailScreen.jsx's Forum button) both land here with
// the same props; posting/reading logic is identical for both, only the
// entry point differs. Manages its own list/detail navigation internally
// instead of pushing that state up into StudentFlow.jsx/TeacherFlow.jsx,
// since it's really one screen's worth of back-and-forth.
export default function ForumScreen({ user, classType, classId, className, onBack, onLogout, onLogoClick }) {
  const { t, i18n } = useTranslation()
  const [threads, setThreads] = useState(null)
  const [listError, setListError] = useState('')
  const [activeThreadId, setActiveThreadId] = useState(null)
  const [activeThread, setActiveThread] = useState(null)
  const [detailError, setDetailError] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [replyError, setReplyError] = useState('')
  const [posting, setPosting] = useState(false)
  const [showNewThread, setShowNewThread] = useState(false)
  const [reportTarget, setReportTarget] = useState(null) // { targetType, targetId }

  function loadThreads() {
    setListError('')
    getForumThreads(classType, classId)
      .then((data) => setThreads(data.threads))
      .catch((err) => setListError(getErrorMessage(err, t, 'forum.loadFailed')))
  }

  // t is a stable function for the app's lifetime (see src/lib/i18n.js) —
  // not a real dependency, and including it would refetch on every
  // language change for no reason.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadThreads, [classType, classId])

  function loadThread(threadId) {
    setDetailError('')
    setActiveThread(null)
    getForumThread(threadId)
      .then((data) => setActiveThread(data))
      .catch((err) => setDetailError(getErrorMessage(err, t, 'forum.loadFailed')))
  }

  useEffect(() => {
    if (activeThreadId) loadThread(activeThreadId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId])

  async function handleReply(e) {
    e.preventDefault()
    if (posting || !replyBody.trim()) return
    setReplyError('')
    setPosting(true)
    try {
      await createForumReply({ thread_id: activeThreadId, body: replyBody.trim() })
      setReplyBody('')
      loadThread(activeThreadId)
    } catch (err) {
      setReplyError(getErrorMessage(err, t, 'forum.postFailed'))
    } finally {
      setPosting(false)
    }
  }

  if (activeThreadId) {
    return (
      <div className="screen">
        <TopBar title={className} username={user.username} onBack={() => setActiveThreadId(null)} onLogout={onLogout} onLogoClick={onLogoClick} />

        {detailError && <p className="form-error">{detailError}</p>}

        {activeThread && (
          <div className="forum-thread-detail">
            <div className="forum-post">
              <p className="forum-post-title">{activeThread.thread.title}</p>
              <p className="forum-post-meta">
                @{activeThread.thread.authorUsername} · {formatDateTime(activeThread.thread.createdAt, i18n.language)}
              </p>
              <p className="forum-post-body">{activeThread.thread.body}</p>
              <button type="button" className="forum-report-link" onClick={() => setReportTarget({ targetType: 'thread', targetId: activeThread.thread.id })}>
                {t('forum.report')}
              </button>
            </div>

            {activeThread.replies.map((reply) => (
              <div key={reply.id} className="forum-reply">
                <p className="forum-post-meta">
                  @{reply.authorUsername} · {formatDateTime(reply.createdAt, i18n.language)}
                </p>
                <p className="forum-post-body">{reply.body}</p>
                <button type="button" className="forum-report-link" onClick={() => setReportTarget({ targetType: 'reply', targetId: reply.id })}>
                  {t('forum.report')}
                </button>
              </div>
            ))}

            <form className="forum-reply-box" onSubmit={handleReply}>
              {replyError && <p className="form-error">{replyError}</p>}
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder={t('forum.replyPlaceholder')}
                rows={3}
                required
              />
              <button type="submit" className="btn btn-primary btn-small" disabled={posting}>
                {posting ? t('forum.posting') : t('forum.replyButton')}
              </button>
            </form>
          </div>
        )}

        {reportTarget && (
          <ReportContentModal
            targetType={reportTarget.targetType}
            targetId={reportTarget.targetId}
            onClose={() => setReportTarget(null)}
            onReported={() => setReportTarget(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="screen">
      <TopBar title={className} username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />

      <button type="button" className="btn btn-primary btn-block" onClick={() => setShowNewThread(true)}>
        {t('forum.newThread')}
      </button>

      {listError && <p className="form-error">{listError}</p>}

      {threads === null ? (
        !listError && <p className="loading-text">{t('common.loading')}</p>
      ) : threads.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-emoji">💬</p>
          <p>{t('forum.noThreadsYet')}</p>
          <button type="button" className="btn btn-secondary" onClick={() => setShowNewThread(true)}>
            {t('forum.startThread')}
          </button>
        </div>
      ) : (
        <div className="forum-thread-list">
          {threads.map((thread) => (
            <button key={thread.id} type="button" className="forum-thread-card" onClick={() => setActiveThreadId(thread.id)}>
              <p className="forum-thread-card-title">{thread.title}</p>
              <p className="forum-thread-card-meta">
                @{thread.authorUsername} · {t('forum.repliesCount', { count: thread.replyCount })} · {formatDateTime(thread.lastActivityAt, i18n.language)}
              </p>
            </button>
          ))}
        </div>
      )}

      {showNewThread && (
        <NewThreadModal
          classType={classType}
          classId={classId}
          onClose={() => setShowNewThread(false)}
          onCreated={() => {
            setShowNewThread(false)
            loadThreads()
          }}
        />
      )}
    </div>
  )
}
