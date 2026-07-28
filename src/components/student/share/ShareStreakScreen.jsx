import { useEffect, useRef, useState } from 'react'
import { getFriendsWithStreaks, getStreakSharesForUser, getTodaysReceivedShares, shareStreakWithFriend } from '../../../lib/storage'
import { hasSharedToday, computeShareStreak } from '../../../lib/streakShare'
import TopBar from '../../shared/TopBar'

export default function ShareStreakScreen({ user, streak, xp, todayScore, today, onBack, onLogout, onLogoClick }) {
  const [friends, setFriends] = useState(null)
  const [shares, setShares] = useState(null)
  const [receivedToday, setReceivedToday] = useState(null)
  const [sendingToId, setSendingToId] = useState(null)
  const [error, setError] = useState('')

  const cardRef = useRef(null)
  const [generating, setGenerating] = useState(false)
  const [cardError, setCardError] = useState('')

  const formattedDate = new Date(`${today}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })

  // Only worth surfacing as a prompt when there's no share streak with that
  // friend yet — once one exists, the middle "Share with Friends" section
  // already shows it every time this screen opens, so repeating it up top
  // too would be redundant nagging rather than a nudge to start one.
  const receivedToShow =
    receivedToday && shares ? receivedToday.filter((r) => computeShareStreak(shares, user.id, r.senderId) === 0) : []

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
      setError("Couldn't share your streak. Please try again.")
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
            title: 'My Zyndal Score',
            text: `I got ${todayScore}/6 correct on Zyndal today! 🎯`,
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
      setCardError("Couldn't generate the share image. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="screen student-screen">
      <TopBar
        title="📤 Share daily score"
        subtitle="With friends or the world"
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      {receivedToShow.length > 0 && (
        <div className="finance-section-card">
          <h3 className="section-heading">Shared with you today</h3>
          <div className="shared-with-you-list">
            {receivedToShow.map((r) => (
              <p key={r.id} className="shared-with-you-row">
                {r.senderAvatar ? `${r.senderAvatar} ` : ''}
                <strong>@{r.senderUsername}</strong> shared their {r.senderStreak} day streak with you 🔥
              </p>
            ))}
          </div>
        </div>
      )}

      <h3 className="section-heading">Share with Friends</h3>
      {error && <p className="form-error">{error}</p>}
      {!friends ? (
        <p className="loading-text">Loading…</p>
      ) : friends.length === 0 ? (
        <p className="field-hint">Add some friends first to share your streak with them.</p>
      ) : (
        <div className="share-friend-list">
          {friends.map((friend) => {
            const sharedToday = shares ? hasSharedToday(shares, user.id, friend.id) : false
            const friendSharedBackToday = shares ? hasSharedToday(shares, friend.id, user.id) : false
            const shareStreak = shares ? computeShareStreak(shares, user.id, friend.id) : 0
            // Mutual-only: the share streak doesn't advance until both sides
            // share the same day, so a one-sided share needs to say so —
            // otherwise it looks like nothing happened.
            const waitingOnFriend = sharedToday && !friendSharedBackToday
            return (
              <button
                key={friend.id}
                type="button"
                className="share-friend-row"
                disabled={sharedToday || sendingToId === friend.id}
                onClick={() => handleShareWithFriend(friend.id)}
              >
                <span className="share-friend-avatar">{friend.avatar || '👤'}</span>
                <div className="share-friend-info">
                  <p className="share-friend-name">@{friend.username}</p>
                  <p className="share-friend-stat share-friend-stat--share">↔️ {shareStreak} day share streak</p>
                  {waitingOnFriend && (
                    <p className="share-friend-stat share-friend-stat--waiting">
                      Waiting for @{friend.username} to share back 🔥
                    </p>
                  )}
                </div>
                <span className={`share-flame ${sharedToday ? 'share-flame--shared' : 'share-flame--pending'}`}>
                  🔥
                </span>
              </button>
            )
          })}
        </div>
      )}

      <h3 className="section-heading">Share to Other Platforms</h3>

      <div className="share-card" ref={cardRef}>
        <div className="share-card-glow share-card-glow--1" />
        <div className="share-card-glow share-card-glow--2" />

        <div className="share-card-top">
          <span className="share-card-bolt">⚡</span>
          <span className="share-card-brand">Zyndal</span>
        </div>

        <div className="share-card-middle">
          <p className="share-card-date">{formattedDate}</p>
          <p className="share-card-score">{todayScore}/6 ✓</p>
          <p className="share-card-username">@{user.username}</p>
          <p className="share-card-xp">⚡ {xp} XP</p>
        </div>
      </div>

      {cardError && <p className="form-error">{cardError}</p>}

      <button type="button" className="btn btn-primary btn-block" onClick={handleShareCard} disabled={generating}>
        {generating ? 'Generating…' : 'Share / Download'}
      </button>
    </div>
  )
}
