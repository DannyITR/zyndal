import { useEffect, useState } from 'react'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  markShareSeen,
  respondToFriendRequest,
} from '../../../lib/storage'
import TopBar from '../../shared/TopBar'
import FriendScoreCardModal from '../share/FriendScoreCardModal'

const TYPE_ICON = {
  score_share: '🔥',
  friend_request: '👋',
  friend_accepted: '🎉',
  perfect_week: '🏆',
  grade_bonus: '🏆',
  streak_reminder: '⚠️',
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// perfect_week and grade_bonus are renderable here (per the schema's CHECK
// constraint) but nothing currently creates them — no code path inserts a
// notification of either type yet. If that's ever requested, the natural
// hook point for perfect_week is submit-answer.js's existing
// recordPerfectWeekAchievement call (api/_lib/db.js), which today only
// records the parent-side bonus-payout row, not a student-facing
// notification.
export default function NotificationsScreen({ user, onBack, onLogout, onLogoClick }) {
  const [notifications, setNotifications] = useState(null)
  const [error, setError] = useState('')
  const [respondingId, setRespondingId] = useState(null)
  const [resolvedRequestIds, setResolvedRequestIds] = useState({}) // notification id -> 'accepted' | 'declined'
  const [viewingShare, setViewingShare] = useState(null)

  async function refresh() {
    try {
      const { notifications: list } = await getNotifications()
      setNotifications(list)
    } catch {
      setError("Couldn't load notifications. Please try again.")
    }
  }

  useEffect(() => {
    let cancelled = false
    getNotifications()
      .then(({ notifications: list }) => {
        if (!cancelled) setNotifications(list)
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load notifications. Please try again.")
      })
    return () => {
      cancelled = true
    }
  }, [user.id])

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead()
      await refresh()
    } catch {
      setError("Couldn't mark all as read. Please try again.")
    }
  }

  async function handleViewShare(notification) {
    try {
      await Promise.all([markNotificationRead(notification.id), markShareSeen(notification.data.share_id)])
    } catch (err) {
      console.error('[Notifications] failed to mark seen/read:', err)
    }
    setViewingShare({
      senderUsername: notification.data.sender_username,
      senderScore: notification.data.sender_score,
    })
    await refresh()
  }

  async function handleRespond(notification, accept) {
    if (respondingId) return
    setRespondingId(notification.id)
    try {
      await respondToFriendRequest(notification.data.request_id, accept)
      setResolvedRequestIds((prev) => ({ ...prev, [notification.id]: accept ? 'accepted' : 'declined' }))
      await markNotificationRead(notification.id)
      await refresh()
    } catch {
      setError("Couldn't update this request. Please try again.")
    } finally {
      setRespondingId(null)
    }
  }

  const unreadCount = notifications ? notifications.filter((n) => !n.readAt).length : 0

  return (
    <div className="screen student-screen">
      <TopBar title="🔔 Notifications" subtitle="Score shares, friend requests, and more" username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />

      {notifications && notifications.length > 0 && (
        <button type="button" className="btn btn-secondary btn-block" disabled={unreadCount === 0} onClick={handleMarkAllRead}>
          Mark all as read
        </button>
      )}

      {error && <p className="form-error">{error}</p>}

      {!notifications ? (
        <p className="loading-text">Loading…</p>
      ) : notifications.length === 0 ? (
        <p className="field-hint">No notifications yet.</p>
      ) : (
        <div className="notification-list">
          {notifications.map((n) => {
            const resolved = resolvedRequestIds[n.id]
            return (
              <div key={n.id} className={`notification-item ${n.readAt ? 'notification-item--read' : 'notification-item--unread'}`}>
                <div className="notification-item-header">
                  <span className="notification-item-icon">{TYPE_ICON[n.type] || '🔔'}</span>
                  <p className="notification-item-title">{n.title}</p>
                </div>
                <p className="notification-item-body">{n.body}</p>
                <p className="notification-item-time">{formatDateTime(n.createdAt)}</p>

                {n.type === 'score_share' && (
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => handleViewShare(n)}>
                    View
                  </button>
                )}

                {n.type === 'friend_request' &&
                  (resolved ? (
                    <p className="field-hint">{resolved === 'accepted' ? 'Accepted ✓' : 'Declined'}</p>
                  ) : (
                    <div className="notification-item-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        disabled={respondingId === n.id}
                        onClick={() => handleRespond(n, true)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-small"
                        disabled={respondingId === n.id}
                        onClick={() => handleRespond(n, false)}
                      >
                        Decline
                      </button>
                    </div>
                  ))}
              </div>
            )
          })}
        </div>
      )}

      {viewingShare && <FriendScoreCardModal share={viewingShare} onClose={() => setViewingShare(null)} />}
    </div>
  )
}
