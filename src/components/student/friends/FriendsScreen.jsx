import { useEffect, useState } from 'react'
import {
  searchStudentsByUsername,
  sendFriendRequest,
  getPendingFriendRequests,
  respondToFriendRequest,
  getFriendsWithStreaks,
  getStreakSharesForUser,
  getIncomingShares,
  markShareSeen,
} from '../../../lib/storage'
import { computeShareStreak } from '../../../lib/streakShare'
import { todayStr } from '../../../lib/streak'
import { getUserTimeZone } from '../../../lib/timezone'
import TopBar from '../../shared/TopBar'
import FriendRequestBanner from './FriendRequestBanner'
import FriendScoreCardModal from '../share/FriendScoreCardModal'

export default function FriendsScreen({ user, onBack, onLogout, onLogoClick }) {
  const [pendingRequests, setPendingRequests] = useState(null)
  const [friends, setFriends] = useState(null)
  const [shares, setShares] = useState(null)
  const [incomingShares, setIncomingShares] = useState([])
  const [viewingShare, setViewingShare] = useState(null)

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState(null)
  const [searchError, setSearchError] = useState('')

  // Timezone-aware "today", passed explicitly to hasSharedToday/computeShareStreak
  // since their default UTC-only todayStr() would mismatch share-score.js's
  // timezone-aware share_date storage in the evening for zones behind UTC.
  const today = todayStr(new Date(), getUserTimeZone())
  const [requestStatusById, setRequestStatusById] = useState({}) // studentId -> 'sending' | 'sent' | error message

  async function refreshFriendsData() {
    const [pending, friendList, shareRows, incoming] = await Promise.all([
      getPendingFriendRequests(user.id),
      getFriendsWithStreaks(user.id),
      getStreakSharesForUser(user.id),
      getIncomingShares(),
    ])
    setPendingRequests(pending)
    setFriends(friendList)
    setShares(shareRows)
    setIncomingShares(incoming)
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getPendingFriendRequests(user.id),
      getFriendsWithStreaks(user.id),
      getStreakSharesForUser(user.id),
      getIncomingShares(),
    ]).then(([pending, friendList, shareRows, incoming]) => {
      if (cancelled) return
      setPendingRequests(pending)
      setFriends(friendList)
      setShares(shareRows)
      setIncomingShares(incoming)
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

  async function handleViewShare(share) {
    setIncomingShares((prev) => prev.filter((s) => s.id !== share.id))
    setViewingShare(share)
    try {
      await markShareSeen(share.id)
    } catch (err) {
      console.error('[Friends] failed to mark share seen:', err)
    }
  }

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim() || searching) return
    setSearching(true)
    setSearchError('')
    try {
      const list = await searchStudentsByUsername(query, user.id)
      setResults(list)
    } catch {
      setSearchError("Couldn't search right now. Please try again.")
    } finally {
      setSearching(false)
    }
  }

  async function handleAddFriend(studentId) {
    setRequestStatusById((prev) => ({ ...prev, [studentId]: 'sending' }))
    try {
      await sendFriendRequest(user.id, studentId)
      setRequestStatusById((prev) => ({ ...prev, [studentId]: 'sent' }))
    } catch (err) {
      setRequestStatusById((prev) => ({ ...prev, [studentId]: err.message || 'Failed' }))
    }
  }

  async function handleRespond(requestId, accept) {
    await respondToFriendRequest(requestId, accept)
    await refreshFriendsData()
  }

  return (
    <div className="screen student-screen">
      <TopBar
        title="👥 Friends"
        subtitle="Find and follow other students"
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      {pendingRequests && pendingRequests.length > 0 && (
        <div className="friend-request-banner-list">
          {pendingRequests.map((request) => (
            <FriendRequestBanner key={request.id} request={request} onRespond={handleRespond} />
          ))}
        </div>
      )}

      <div className="finance-section-card">
        <h3 className="section-heading">Find Students</h3>
        <form className="friend-search-form" onSubmit={handleSearch}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username"
          />
          <button type="submit" className="btn btn-secondary btn-small" disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>
        {searchError && <p className="form-error">{searchError}</p>}

        {results && results.length === 0 && <p className="field-hint">No students found.</p>}

        {results && results.length > 0 && (
          <div className="friend-search-results">
            {results.map((student) => {
              const status = requestStatusById[student.id]
              const isPendingOrSent = status === 'sending' || status === 'sent'
              return (
                <div key={student.id} className="friend-search-row">
                  <span className="friend-search-name">@{student.username}</span>
                  {status === 'sent' ? (
                    <span className="friend-search-status">Requested ✓</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      disabled={isPendingOrSent}
                      onClick={() => handleAddFriend(student.id)}
                    >
                      {status === 'sending' ? 'Sending…' : '+ Add Friend'}
                    </button>
                  )}
                  {status && !isPendingOrSent && <p className="friend-search-error">{status}</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="finance-section-card">
        <h3 className="section-heading">Your Friends</h3>
        {!friends ? (
          <p className="loading-text">Loading…</p>
        ) : friends.length === 0 ? (
          <p className="field-hint">No friends yet — search above to follow someone.</p>
        ) : (
          <div className="finance-student-list">
            {friends.map((friend) => {
              const shareStreak = shares ? computeShareStreak(shares, user.id, friend.id, today) : 0
              const incoming = incomingShares.find((s) => s.senderId === friend.id)
              const rowContent = (
                <>
                  <div>
                    <p className="finance-student-name">
                      @{friend.username}
                      {incoming && <span className="friend-share-badge">1</span>}
                    </p>
                    <p className="finance-student-detail">
                      {shareStreak > 0
                        ? `🔥 ${shareStreak} day share streak`
                        : '🔥 Start a share streak — share your daily score!'}
                    </p>
                  </div>
                </>
              )
              return incoming ? (
                <button
                  key={friend.id}
                  type="button"
                  className="finance-student-row finance-student-row--clickable"
                  onClick={() => handleViewShare(incoming)}
                >
                  {rowContent}
                </button>
              ) : (
                <div key={friend.id} className="finance-student-row">
                  {rowContent}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {viewingShare && <FriendScoreCardModal share={viewingShare} onClose={() => setViewingShare(null)} />}
    </div>
  )
}
