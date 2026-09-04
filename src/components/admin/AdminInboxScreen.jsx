import { useEffect, useState } from 'react'
import { getAdminInboxConversations, getAdminInboxMessages, sendAdminInboxMessage, startAdminConversation } from '../../lib/adminApi'

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

// Admin's OWN private conversations, as a participant — distinct from
// AdminMessagesScreen.jsx (read-only platform-wide browse of every DM).
// initialTargetUserId (set when opened via AdminDashboard's per-row
// "Message" action, or AdminReportsScreen's "Message Sender" action) starts
// or resumes a conversation with that user directly and jumps to the
// thread, skipping the list — same pattern as MessagesFlow.jsx's
// initialOtherUserId.
export default function AdminInboxScreen({ onBack, onLogout, initialTargetUserId }) {
  const [conversations, setConversations] = useState(null)
  const [listError, setListError] = useState('')
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [activeOtherUser, setActiveOtherUser] = useState(null)
  const [messages, setMessages] = useState(null)
  const [detailError, setDetailError] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)

  function loadConversations() {
    setListError('')
    getAdminInboxConversations()
      .then((data) => setConversations(data.conversations))
      .catch((err) => setListError(err.message || 'Failed to load conversations.'))
  }

  function loadMessages(conversationId) {
    setDetailError('')
    setMessages(null)
    getAdminInboxMessages(conversationId)
      .then((data) => setMessages(data.messages))
      .catch((err) => setDetailError(err.message || 'Failed to load messages.'))
  }

  function openConversation(conversation) {
    setActiveConversationId(conversation.id)
    setActiveOtherUser(conversation.otherUser)
    loadMessages(conversation.id)
  }

  useEffect(() => {
    if (initialTargetUserId) {
      startAdminConversation(initialTargetUserId)
        .then(({ conversation, otherUser }) => {
          setActiveConversationId(conversation.id)
          setActiveOtherUser(otherUser)
          loadMessages(conversation.id)
        })
        .catch((err) => setDetailError(err.message || 'Failed to start conversation.'))
    } else {
      loadConversations()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTargetUserId])

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
    setSending(true)
    try {
      await sendAdminInboxMessage(activeConversationId, trimmed)
      setMessageBody('')
      loadMessages(activeConversationId)
    } catch (err) {
      setSendError(err.message || 'Failed to send.')
    } finally {
      setSending(false)
    }
  }

  if (activeConversationId) {
    return (
      <div className="admin-page">
        <header className="admin-header">
          <div>
            <button type="button" className="admin-back-link" onClick={handleBackToList}>
              ← Back to Inbox
            </button>
            <h1>{activeOtherUser ? `@${activeOtherUser.username}` : 'Conversation'}</h1>
          </div>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={onLogout}>
            Log Out
          </button>
        </header>

        {detailError && <p className="admin-error admin-panel">{detailError}</p>}

        <section className="admin-panel">
          <div className="admin-message-log">
            {messages && messages.length === 0 && <p className="admin-table-empty">No messages yet.</p>}
            {messages?.map((m) => (
              <div key={m.id} className="admin-message-log-row">
                <span className="admin-message-log-meta">
                  {m.isMine ? 'Me (Admin)' : activeOtherUser ? `@${activeOtherUser.username}` : 'Them'}
                  {' · '}
                  {formatDateTime(m.createdAt)}
                </span>
                <p>{m.body}</p>
              </div>
            ))}
          </div>

          <form className="admin-message-input" onSubmit={handleSend}>
            {sendError && <p className="admin-error">{sendError}</p>}
            <input
              type="text"
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="Type a message…"
              maxLength={2000}
              required
            />
            <button type="submit" className="admin-btn admin-btn-primary" disabled={sending}>
              {sending ? 'Sending…' : 'Send'}
            </button>
          </form>
        </section>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <button type="button" className="admin-back-link" onClick={onBack}>
            ← Back to Dashboard
          </button>
          <h1>Inbox</h1>
        </div>
        <button type="button" className="admin-btn admin-btn-secondary" onClick={onLogout}>
          Log Out
        </button>
      </header>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Your Conversations</h2>
        </div>

        {listError && <p className="admin-error">{listError}</p>}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Last Message</th>
                <th>Unread</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {conversations === null && !listError && (
                <tr>
                  <td colSpan={4} className="admin-table-empty">
                    Loading…
                  </td>
                </tr>
              )}
              {conversations && conversations.length === 0 && (
                <tr>
                  <td colSpan={4} className="admin-table-empty">
                    No conversations yet.
                  </td>
                </tr>
              )}
              {conversations?.map((c) => (
                <tr key={c.id}>
                  <td>@{c.otherUser.username}</td>
                  <td>{c.lastMessagePreview || '—'}</td>
                  <td>{c.unreadCount > 0 ? c.unreadCount : ''}</td>
                  <td className="admin-row-actions">
                    <button type="button" className="admin-btn admin-btn-small" onClick={() => openConversation(c)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
