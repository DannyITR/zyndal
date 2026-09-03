import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getConversations, getOrCreateConversation, getMessages, sendMessage, reportMessage } from '../../../lib/storage'
import { getErrorMessage } from '../../../lib/errors'
import { containsProfanity } from '../../../lib/profanityFilter'
import { LOCALE_FOR_LANGUAGE } from '../../../lib/i18n'
import TopBar from '../../shared/TopBar'
import ReportContentModal from '../../shared/forum/ReportContentModal'

function formatDateTime(value, language) {
  return new Date(value).toLocaleString(LOCALE_FOR_LANGUAGE[language] || 'en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

// This app has no live channel to the database at all — storage.js
// deliberately never talks to Supabase directly from the browser (RLS
// blocks the anon key from reading/writing any table with no policies
// defined, and every screen in this app already goes through its own
// session-authenticated /api endpoint instead — see storage.js's own
// header comment), and nothing else in the app uses Supabase Realtime.
// Polling is the fit here, not a new direct-to-Supabase channel — same
// "refetch on an interval / on navigation" shape every other screen in
// this app already uses, just on a timer instead of only on user action.
const POLL_INTERVAL_MS = 4000

// Self-contained list/thread navigation, same pattern as ForumScreen.jsx.
// initialFriendId (set when opened from FriendsScreen.jsx's message button)
// resolves/creates that conversation and jumps straight to the thread,
// skipping the list entirely — otherwise this starts on the conversation
// list like ForumScreen starts on the thread list.
export default function MessagesFlow({ user, initialFriendId, onBack, onLogout, onLogoClick }) {
  const { t, i18n } = useTranslation()
  const [conversations, setConversations] = useState(null)
  const [listError, setListError] = useState('')
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [activeOtherUser, setActiveOtherUser] = useState(null)
  const [messages, setMessages] = useState(null)
  const [detailError, setDetailError] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)
  const [reportTarget, setReportTarget] = useState(null) // a message id, or null

  function loadConversations() {
    setListError('')
    getConversations()
      .then((data) => setConversations(data.conversations))
      .catch((err) => setListError(getErrorMessage(err, t, 'messages.loadFailed')))
  }

  function loadMessages(conversationId) {
    setDetailError('')
    setMessages(null)
    getMessages(conversationId)
      .then((data) => setMessages(data.messages))
      .catch((err) => setDetailError(getErrorMessage(err, t, 'messages.loadFailed')))
  }

  function openConversation(conversation) {
    setActiveConversationId(conversation.id)
    setActiveOtherUser(conversation.otherUser)
    loadMessages(conversation.id)
  }

  useEffect(() => {
    if (initialFriendId) {
      getOrCreateConversation(initialFriendId)
        .then(({ conversation, otherUser }) => {
          setActiveConversationId(conversation.id)
          setActiveOtherUser(otherUser)
          loadMessages(conversation.id)
        })
        .catch((err) => setDetailError(getErrorMessage(err, t, 'messages.loadFailed')))
    } else {
      loadConversations()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFriendId])

  // Live-updates the open thread — polls quietly (no loading flash, no
  // error banner on a transient miss) so a message the other participant
  // sends while this is open just appears on the next tick. Each poll hits
  // the same get-messages.js call the initial open used, whose own
  // mark-as-read side effect keeps firing too, so a message that arrives
  // while the student is actively looking at the thread is marked read
  // without any extra call.
  useEffect(() => {
    if (!activeConversationId) return
    const interval = setInterval(() => {
      getMessages(activeConversationId)
        .then((data) => setMessages(data.messages))
        .catch(() => {})
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [activeConversationId])

  // Same idea for the conversation list — unread counts and last-message
  // previews update live instead of only refreshing when the list is
  // re-entered.
  useEffect(() => {
    if (activeConversationId) return
    const interval = setInterval(() => {
      getConversations()
        .then((data) => setConversations(data.conversations))
        .catch(() => {})
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [activeConversationId])

  // Refetches the list on the way back, same reasoning as ForumScreen.jsx's
  // handleBackToList — unread counts and last-message previews only change
  // while a thread is open, so the list needs a fresh fetch to reflect them.
  function handleBackToList() {
    setActiveConversationId(null)
    setActiveOtherUser(null)
    setMessages(null)
    loadConversations()
  }

  async function handleSend(e) {
    e.preventDefault()
    const trimmed = messageBody.trim()
    if (sending || !trimmed) return
    setSendError('')

    // Same client-side fast-fail as NewThreadModal.jsx, backed by the same
    // authoritative server-side check in api/messages/send-message.js.
    if (containsProfanity(trimmed)) {
      setSendError(t('forum.profanityWarning'))
      return
    }

    setSending(true)
    try {
      await sendMessage(activeConversationId, trimmed)
      setMessageBody('')
      loadMessages(activeConversationId)
    } catch (err) {
      setSendError(getErrorMessage(err, t, 'messages.sendFailed'))
    } finally {
      setSending(false)
    }
  }

  if (activeConversationId) {
    return (
      <div className="screen">
        <TopBar
          title={activeOtherUser ? `@${activeOtherUser.username}` : t('messages.title')}
          username={user.username}
          onBack={handleBackToList}
          onLogout={onLogout}
          onLogoClick={onLogoClick}
        />

        {detailError && <p className="form-error">{detailError}</p>}

        {messages && (
          <div className="message-thread">
            {messages.length === 0 && <p className="field-hint">{t('messages.noMessagesYet')}</p>}
            {messages.map((m) => (
              <div key={m.id} className={`message-bubble ${m.isMine ? 'message-bubble--mine' : 'message-bubble--theirs'}`}>
                <p className="message-bubble-body">{m.body}</p>
                <div className="message-bubble-meta">
                  <span>{formatDateTime(m.createdAt, i18n.language)}</span>
                  <button type="button" className="forum-report-link" onClick={() => setReportTarget(m.id)}>
                    {t('forum.report')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form className="message-input-box" onSubmit={handleSend}>
          {sendError && <p className="form-error">{sendError}</p>}
          <input
            type="text"
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder={t('messages.placeholder')}
            maxLength={2000}
            required
          />
          <button type="submit" className="btn btn-primary btn-small" disabled={sending}>
            {sending ? t('messages.sending') : t('messages.send')}
          </button>
        </form>

        {reportTarget && (
          <ReportContentModal
            onSubmit={(reason) => reportMessage({ message_id: reportTarget, reason })}
            onClose={() => setReportTarget(null)}
            onReported={() => setReportTarget(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="screen">
      <TopBar title={t('messages.title')} username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />

      {listError && <p className="form-error">{listError}</p>}

      {conversations === null ? (
        !listError && <p className="loading-text">{t('common.loading')}</p>
      ) : conversations.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-emoji">💬</p>
          <p>{t('messages.noConversationsYet')}</p>
        </div>
      ) : (
        <div className="conversation-list">
          {conversations.map((c) => (
            <button key={c.id} type="button" className="conversation-row" onClick={() => openConversation(c)}>
              <span className="conversation-row-avatar">{c.otherUser.avatar || '👤'}</span>
              <div className="conversation-row-info">
                <p className="conversation-row-name">@{c.otherUser.username}</p>
                {c.lastMessagePreview && (
                  <p className="conversation-row-preview">
                    {c.lastMessageSenderId === user.id ? `${t('messages.youPrefix')} ` : ''}
                    {c.lastMessagePreview}
                  </p>
                )}
              </div>
              {c.unreadCount > 0 && <span className="conversation-row-unread">{c.unreadCount}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
