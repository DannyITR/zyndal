import { useEffect, useRef, useState } from 'react'
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
  homework_assigned: '📚',
  homework_reminder: '📚',
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
export default function NotificationsScreen({ user, onBack, onLogout, onLogoClick, openHomeworkIds, onOpenHomework }) {
  const [notifications, setNotifications] = useState(null)
  const [error, setError] = useState('')
  const [respondingId, setRespondingId] = useState(null)
  const [resolvedRequestIds, setResolvedRequestIds] = useState({}) // notification id -> 'accepted' | 'declined'
  const [viewingShare, setViewingShare] = useState(null)
  // Guards the auto-mark-as-read effect below so it only ever schedules its
  // one 2-second timer once per page visit — without this, refresh() calls
  // triggered by the user's own actions (accepting a request, viewing a
  // share) would change `notifications` and re-run the effect, restarting
  // the countdown instead of leaving it tied to when the page was opened.
  const autoMarkScheduledRef = useRef(false)

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

  // Auto-marks everything read 2 seconds after the list first loads, so a
  // student still gets a moment to see which notifications were unread
  // (the highlighted background) before they lose that highlight — without
  // needing to press "Mark all as read" (still available below for anyone
  // who wants to clear it immediately). Runs once per page visit: see
  // autoMarkScheduledRef's comment above.
  useEffect(() => {
    if (!notifications || autoMarkScheduledRef.current) return
    const hasUnread = notifications.some((n) => !n.readAt)
    if (!hasUnread) return
    autoMarkScheduledRef.current = true
    const timer = setTimeout(() => {
      markAllNotificationsRead()
        .then(refresh)
        .catch((err) => console.error('[Notifications] failed to auto-mark all as read:', err))
    }, 2000)
    return () => clearTimeout(timer)
  }, [notifications])

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

                {(n.type === 'homework_assigned' || n.type === 'homework_reminder') &&
                  n.data?.assignment_id &&
                  openHomeworkIds?.has(n.data.assignment_id) && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => onOpenHomework(n.data.assignment_id)}
                  >
                    Open Homework
                  </button>
                )}

                {n.type === 'friend_request' &&
                  (() => {
                    // `resolved` (local, set immediately on click) takes
                    // priority over `requestStatus` (from the server, as of
                    // the last load) purely so the UI updates instantly on
                    // this screen without waiting on the refresh() that
                    // follows — both end up showing the same thing once
                    // that refresh lands. `requestStatus` is what makes this
                    // correct on a fresh page load/reload, when `resolved`
                    // is always empty regardless of what already happened
                    // to the request (e.g. accepted from the Friends
                    // screen's banner instead of from here).
                    const status = resolved || n.requestStatus
                    if (status === 'accepted') return <p className="notification-item-status notification-item-status--accepted">✓ Now friends</p>
                    if (status === 'declined') return <p className="notification-item-status notification-item-status--declined">Declined</p>
                    return (
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
                    )
                  })()}
              </div>
            )
          })}
        </div>
      )}

      {viewingShare && <FriendScoreCardModal share={viewingShare} onClose={() => setViewingShare(null)} />}
    </div>
  )
}
