import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  markShareSeen,
  respondToFriendRequest,
  respondToParentLinkRequest,
} from '../../../lib/storage'
import { LOCALE_FOR_LANGUAGE } from '../../../lib/i18n'
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
  parent_link_request: '👨‍👩‍👧',
  work_approved: '✅',
  work_rejected: '✏️',
  // No entry for parent_link_accepted — its title text already leads with
  // "✅" (see link-parent.js/respond-parent-link.js), so a TYPE_ICON here
  // would just render a second checkmark right next to the first one.
}

function formatDateTime(iso, language) {
  const locale = LOCALE_FOR_LANGUAGE[language] || 'en-US'
  return new Date(iso).toLocaleString(locale, {
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
  const { t, i18n } = useTranslation()
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
      setError(t('notifications.loadError'))
    }
  }

  useEffect(() => {
    let cancelled = false
    getNotifications()
      .then(({ notifications: list }) => {
        if (!cancelled) setNotifications(list)
      })
      .catch(() => {
        if (!cancelled) setError(t('notifications.loadError'))
      })
    return () => {
      cancelled = true
    }
    // t is a stable function for the app's lifetime (see src/lib/i18n.js) —
    // not a real dependency, and including it would refetch on every
    // language change for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // refresh is a plain function redefined every render, not a stable
    // dependency (only recently started closing over `t` from
    // useTranslation, which is what surfaced this warning) — adding it
    // would re-arm this effect's guard logic in ways unrelated to this
    // change. Pre-existing pattern, left as-is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications])

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead()
      await refresh()
    } catch {
      setError(t('notifications.markAllFailed'))
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
      setError(t('notifications.updateFailed'))
    } finally {
      setRespondingId(null)
    }
  }

  async function handleRespondParentLink(notification, accept) {
    if (respondingId) return
    setRespondingId(notification.id)
    try {
      await respondToParentLinkRequest(notification.data.invitation_id, accept)
      setResolvedRequestIds((prev) => ({ ...prev, [notification.id]: accept ? 'accepted' : 'declined' }))
      await markNotificationRead(notification.id)
      await refresh()
    } catch {
      setError(t('notifications.updateFailed'))
    } finally {
      setRespondingId(null)
    }
  }

  const unreadCount = notifications ? notifications.filter((n) => !n.readAt).length : 0

  return (
    <div className="screen student-screen">
      <TopBar title={t('notifications.title')} subtitle={t('notifications.subtitle')} username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />

      {notifications && notifications.length > 0 && (
        <button type="button" className="btn btn-secondary btn-block" disabled={unreadCount === 0} onClick={handleMarkAllRead}>
          {t('notifications.markAllRead')}
        </button>
      )}

      {error && <p className="form-error">{error}</p>}

      {!notifications ? (
        <p className="loading-text">{t('common.loading')}</p>
      ) : notifications.length === 0 ? (
        <p className="field-hint">{t('notifications.noNotifications')}</p>
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
                <p className="notification-item-time">{formatDateTime(n.createdAt, i18n.language)}</p>

                {n.type === 'score_share' && (
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => handleViewShare(n)}>
                    {t('notifications.view')}
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
                    {t('notifications.openHomework')}
                  </button>
                )}

                {n.type === 'parent_link_request' &&
                  (() => {
                    const status = resolved || n.invitationStatus
                    if (status === 'accepted') return <p className="notification-item-status notification-item-status--accepted">{t('notifications.linked')}</p>
                    if (status === 'declined') return <p className="notification-item-status notification-item-status--declined">{t('common.declined')}</p>
                    return (
                      <div className="notification-item-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-small"
                          disabled={respondingId === n.id}
                          onClick={() => handleRespondParentLink(n, true)}
                        >
                          {t('common.accept')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-small"
                          disabled={respondingId === n.id}
                          onClick={() => handleRespondParentLink(n, false)}
                        >
                          {t('common.decline')}
                        </button>
                      </div>
                    )
                  })()}

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
                    if (status === 'accepted') return <p className="notification-item-status notification-item-status--accepted">{t('notifications.nowFriends')}</p>
                    if (status === 'declined') return <p className="notification-item-status notification-item-status--declined">{t('common.declined')}</p>
                    return (
                      <div className="notification-item-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-small"
                          disabled={respondingId === n.id}
                          onClick={() => handleRespond(n, true)}
                        >
                          {t('common.accept')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-small"
                          disabled={respondingId === n.id}
                          onClick={() => handleRespond(n, false)}
                        >
                          {t('common.decline')}
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
