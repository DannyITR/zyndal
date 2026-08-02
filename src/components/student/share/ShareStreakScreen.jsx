import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getFriendsWithStreaks, getStreakSharesForUser, getTodaysReceivedShares, shareStreakWithFriend } from '../../../lib/storage'
import { hasSharedToday, computeShareStreak } from '../../../lib/streakShare'
import { SCORE_COLORS, TOTAL_SUBJECTS, formatLongDate } from '../../../lib/streak'
import TopBar from '../../shared/TopBar'
import FriendSharePickerModal from './FriendSharePickerModal'

export default function ShareStreakScreen({ user, streak, xp, todayScore, today, onBack, onLogout, onLogoClick }) {
  const { t } = useTranslation()
  const [friends, setFriends] = useState(null)
  const [shares, setShares] = useState(null)
  const [receivedToday, setReceivedToday] = useState(null)
  const [sendingToId, setSendingToId] = useState(null)
  const [error, setError] = useState('')
  const [showFriendPicker, setShowFriendPicker] = useState(false)

  const cardRef = useRef(null)
  const [generating, setGenerating] = useState(false)
  const [cardError, setCardError] = useState('')

  const formattedDate = formatLongDate(today)

  // Only worth surfacing as a prompt when there's no share streak with that
  // friend yet — once one exists, the active-streak friend list below
  // already shows it every time this screen opens, so repeating it up top
  // too would be redundant nagging rather than a nudge to start one.
  //
  // Every hasSharedToday/computeShareStreak call in this file passes the
  // `today` prop explicitly (this screen's own timezone-aware "today",
  // matching how share-score.js now stores share_date) rather than relying
  // on those functions' default `today = todayStr()` parameter, which is
  // UTC-only — a student browsing in the evening in a zone behind UTC could
  // otherwise see share_date="today (local)" rows compared against
  // todayStr()'s "tomorrow (UTC)", silently treating every share as
  // "not today".
  const receivedToShow =
    receivedToday && shares
      ? receivedToday.filter((r) => computeShareStreak(shares, user.id, r.senderId, today) === 0)
      : []

  const scoreColor = SCORE_COLORS[Math.min(Math.max(todayScore, 0), 6)]

  // Matches api/social/share-score.js's own server-side check exactly (all
  // 6 subjects answered CORRECTLY, not merely attempted) — a stricter gate
  // than this screen used to apply, and with no exception for reciprocal
  // "share back" shares, since the server no longer allows one either.
  const canShareToday = todayScore >= TOTAL_SUBJECTS

  // Only friends with an established (1+ day) mutual share streak are worth
  // surfacing as a card here — everyone else is reachable via the picker
  // modal instead of cluttering the main screen with 0-streak friends.
  const activeStreakFriends = friends
    ? friends.filter((friend) => shares && computeShareStreak(shares, user.id, friend.id, today) >= 1)
    : []

  useEffect(() => {
    let cancelled = false
    Promise.all([getFriendsWithStreaks(user.id), getStreakSharesForUser(user.id), getTodaysReceivedShares(user.id)]).then(
      ([friendList, shareRows, received]) => {
        if (cancelled) return
        setFriends(friendList)
        setShares(shareRows)
        setReceivedToday(received)
      }
    )
    return () => {
      cancelled = true
    }
  }, [user.id])

  async function handleShareWithFriend(friendId) {
    if (sendingToId) return
    setSendingToId(friendId)
    setError('')
    try {
      await shareStreakWithFriend(user.id, friendId, streak)
      const shareRows = await getStreakSharesForUser(user.id)
      setShares(shareRows)
    } catch (err) {
      console.error('[Share] streak share failed:', err)
      setError(t('share.streakShareFailed'))
    } finally {
      setSendingToId(null)
    }
  }

  // Loaded on demand — most sessions never generate the share card image.
  async function renderCanvas() {
    const { default: html2canvas } = await import('html2canvas')
    if (document.fonts?.ready) await document.fonts.ready
    return html2canvas(cardRef.current, { backgroundColor: null, scale: 3 })
  }

  async function handleShareCard() {
    setGenerating(true)
    setCardError('')
    try {
      const canvas = await renderCanvas()
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Could not generate image')

      const fileName = `zyndal-score-${user.username}.png`
      const file = new File([blob], fileName, { type: 'image/png' })

      let shared = false
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: t('share.myScoreTitle'),
            text: t('share.myScoreText', { score: todayScore }),
          })
          shared = true
        } catch (err) {
          if (err.name === 'AbortError') return // user cancelled the share sheet
          // Some browsers report canShare() true but then reject share() itself
          // (e.g. lost user-activation after the async render) — fall back to
          // downloading the image we already generated rather than erroring out.
        }
      }

      if (!shared) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      setCardError(t('share.generateImageFailed'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="screen student-screen">
      <TopBar username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />

      {receivedToShow.length > 0 && (
        <div className="finance-section-card">
          <h3 className="section-heading">{t('share.sharedWithYouToday')}</h3>
          <div className="shared-with-you-list">
            {receivedToShow.map((r) => (
              <div key={r.id} className="shared-with-you-row">
                <p className="shared-with-you-text">
                  <strong>@{r.senderUsername}</strong> {t('share.sharedScoreWithYou')}
                </p>
                {canShareToday ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-small shared-with-you-back-btn"
                    disabled={sendingToId === r.senderId}
                    onClick={() => handleShareWithFriend(r.senderId)}
                  >
                    {sendingToId === r.senderId ? t('common.sending') : t('share.shareBack')}
                  </button>
                ) : (
                  <p className="field-hint share-friend-locked-hint">{t('share.completeToShareBack')}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
      <button type="button" className="btn btn-primary btn-block" onClick={() => setShowFriendPicker(true)}>
        {t('share.shareWithFriends')}
      </button>
      {activeStreakFriends.length > 0 && (
        <div className="share-friend-list">
          {activeStreakFriends.map((friend) => {
            const sharedToday = shares ? hasSharedToday(shares, user.id, friend.id, today) : false
            const friendSharedBackToday = shares ? hasSharedToday(shares, friend.id, user.id, today) : false
            const shareStreak = shares ? computeShareStreak(shares, user.id, friend.id, today) : 0
            // Mutual-only: the share streak doesn't advance until both sides
            // share the same day, so a one-sided share needs to say so —
            // otherwise it looks like nothing happened.
            const waitingOnFriend = sharedToday && !friendSharedBackToday
            return (
              <div key={friend.id} className="share-friend-summary-row">
                <span className="share-friend-avatar">{friend.avatar || '👤'}</span>
                <div className="share-friend-info">
                  <p className="share-friend-name">@{friend.username}</p>
                  <p className="share-friend-stat share-friend-stat--share">{t('friends.shareStreakDay', { count: shareStreak })}</p>
                  {waitingOnFriend && (
                    <p className="share-friend-stat share-friend-stat--waiting">
                      {t('share.waitingOnFriend', { username: friend.username })}
                    </p>
                  )}
                </div>
                {sharedToday ? (
                  <span className="friend-picker-shared">{t('common.sharedTodayBadge')}</span>
                ) : canShareToday ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    disabled={sendingToId === friend.id}
                    onClick={() => handleShareWithFriend(friend.id)}
                  >
                    {sendingToId === friend.id ? t('common.sending') : t('common.shareCta')}
                  </button>
                ) : (
                  <p className="field-hint share-friend-locked-hint">{t('share.finishToShare')}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showFriendPicker && (
        <FriendSharePickerModal
          user={user}
          friends={friends || []}
          shares={shares}
          today={today}
          sendingToId={sendingToId}
          canShareToday={canShareToday}
          onShare={handleShareWithFriend}
          onClose={() => setShowFriendPicker(false)}
        />
      )}

      <div className="share-card" ref={cardRef}>
        <div className="share-card-glow share-card-glow--1" />
        <div className="share-card-glow share-card-glow--2" />

        <div className="share-card-top">
          <span className="share-card-bolt">⚡</span>
          <span className="share-card-brand">Zyndal</span>
          {/* Invisible mirror of the bolt — same content so it takes the
              same width, keeping the text column truly centered on the
              card without moving the real bolt from beside the Z. */}
          <span className="share-card-bolt share-card-bolt--mirror" aria-hidden="true">
            ⚡
          </span>
        </div>

        <div className="share-card-middle">
          <p className="share-card-date">{formattedDate}</p>
          <p className="share-card-score" style={{ color: scoreColor }}>
            {todayScore}/6
          </p>
          <p className="share-card-username">@{user.username}</p>
          <p className="share-card-xp">⚡ {xp} XP</p>
        </div>
      </div>

      {cardError && <p className="form-error">{cardError}</p>}

      <button type="button" className="btn btn-primary share-download-btn" onClick={handleShareCard} disabled={generating}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        {generating ? t('share.generating') : t('share.shareExternally')}
      </button>
    </div>
  )
}
