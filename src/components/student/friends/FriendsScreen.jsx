import { useEffect, useRef, useState } from 'react'
import {
  searchStudentsByUsername,
  sendFriendRequest,
  getPendingFriendRequests,
  respondToFriendRequest,
  getFriendsWithStreaks,
  getStreakSharesForUser,
  getIncomingShares,
  markShareSeen,
  shareStreakWithFriend,
} from '../../../lib/storage'
import { hasSharedToday, computeShareStreak } from '../../../lib/streakShare'
import { todayStr } from '../../../lib/streak'
import { getUserTimeZone } from '../../../lib/timezone'
import TopBar from '../../shared/TopBar'
import FriendRequestBanner from './FriendRequestBanner'
import FriendScoreCardModal from '../share/FriendScoreCardModal'

export default function FriendsScreen({ user, canShareToday, onBack, onLogout, onLogoClick }) {
  const [pendingRequests, setPendingRequests] = useState(null)
  const [friends, setFriends] = useState(null)
  const [shares, setShares] = useState(null)
  const [incomingShares, setIncomingShares] = useState([])
  const [viewingShare, setViewingShare] = useState(null)
  const [sendingToId, setSendingToId] = useState(null)
  const [shareError, setShareError] = useState('')

  // Live autocomplete search — query.length >= 2 triggers a debounced
  // (300ms) search-users.js call; skipNextSearchRef suppresses the search
  // that would otherwise re-fire when handleSelectResult programmatically
  // sets `query` to the picked username.
  const [query, setQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownResults, setDropdownResults] = useState(null) // null = no search yet, [] = no matches, [...] = matches
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [requestStatus, setRequestStatus] = useState('') // '' | 'sending' | 'sent' | error message
  const searchContainerRef = useRef(null)
  const skipNextSearchRef = useRef(false)

  // Timezone-aware "today", passed explicitly to hasSharedToday/computeShareStreak
  // since their default UTC-only todayStr() would mismatch share-score.js's
  // timezone-aware share_date storage in the evening for zones behind UTC.
  const today = todayStr(new Date(), getUserTimeZone())

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false
      return
    }
    setSelectedUser(null)
    setRequestStatus('')
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setDropdownResults(null)
      setDropdownOpen(false)
      setSearching(false)
      setSearchError('')
      return
    }
    setSearchError('')
    let cancelled = false
    const timer = setTimeout(() => {
      if (cancelled) return
      setSearching(true)
      setDropdownOpen(true)
      searchStudentsByUsername(trimmed, user.id)
        .then((list) => {
          if (cancelled) return
          setDropdownResults(list)
        })
        .catch(() => {
          if (cancelled) return
          setSearchError("Couldn't search right now. Please try again.")
          setDropdownOpen(false)
          setDropdownResults(null)
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, user.id])

  // Closes the dropdown on any click outside the input+dropdown container —
  // doesn't clear the query or results, so refocusing the input can still
  // reopen it via the onFocus handler below.
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelectResult(result) {
    skipNextSearchRef.current = true
    setQuery(result.username)
    setSelectedUser(result)
    setDropdownOpen(false)
  }

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

  async function handleSendRequest() {
    if (!selectedUser || requestStatus === 'sending' || requestStatus === 'sent') return
    setRequestStatus('sending')
    try {
      await sendFriendRequest(user.id, selectedUser.id)
      setRequestStatus('sent')
    } catch (err) {
      setRequestStatus(err.message || 'Failed')
    }
  }

  async function handleRespond(requestId, accept) {
    await respondToFriendRequest(requestId, accept)
    await refreshFriendsData()
  }

  // Mirrors ShareStreakScreen.jsx's own handleShareWithFriend — this screen
  // now offers the same direct per-friend Share action (see the redesigned
  // "Your Friends" list below) instead of only being reachable through that
  // screen's separate friend-picker modal.
  async function handleShareWithFriend(friendId) {
    if (sendingToId) return
    setSendingToId(friendId)
    setShareError('')
    try {
      await shareStreakWithFriend(user.id, friendId)
      const shareRows = await getStreakSharesForUser(user.id)
      setShares(shareRows)
    } catch (err) {
      console.error('[Friends] streak share failed:', err)
      setShareError("Couldn't share your score. Please try again.")
    } finally {
      setSendingToId(null)
    }
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
        <div className="friend-search-input-wrap" ref={searchContainerRef}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (dropdownResults !== null) setDropdownOpen(true)
            }}
            placeholder="Search friends by username..."
          />

          {dropdownOpen && (
            <div className="friend-search-dropdown">
              {searching ? (
                <p className="friend-search-dropdown-empty">Searching…</p>
              ) : dropdownResults && dropdownResults.length === 0 ? (
                <p className="friend-search-dropdown-empty">No users found with that username</p>
              ) : (
                dropdownResults?.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className="friend-search-dropdown-item"
                    onClick={() => handleSelectResult(result)}
                  >
                    <span className="friend-search-dropdown-avatar">{result.avatar || '👤'}</span>
                    <span className="friend-search-dropdown-info">
                      <span className="friend-search-dropdown-username">@{result.username}</span>
                      {result.grade && <span className="friend-search-dropdown-grade">Grade {result.grade}</span>}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        {searchError && <p className="form-error">{searchError}</p>}

        {selectedUser && (
          <div className="friend-search-row">
            <span className="friend-search-name">@{selectedUser.username}</span>
            {requestStatus === 'sent' ? (
              <span className="friend-search-status">Requested ✓</span>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-small"
                disabled={requestStatus === 'sending'}
                onClick={handleSendRequest}
              >
                {requestStatus === 'sending' ? 'Sending…' : 'Send Friend Request'}
              </button>
            )}
            {requestStatus && requestStatus !== 'sending' && requestStatus !== 'sent' && (
              <p className="friend-search-error">{requestStatus}</p>
            )}
          </div>
        )}
      </div>

      <div className="finance-section-card">
        <h3 className="section-heading">Your Friends</h3>
        {shareError && <p className="form-error">{shareError}</p>}
        {!friends ? (
          <p className="loading-text">Loading…</p>
        ) : friends.length === 0 ? (
          <p className="field-hint">No friends yet — search above to follow someone.</p>
        ) : (
          <div className="friend-picker-list">
            {friends.map((friend) => {
              const shareStreak = shares ? computeShareStreak(shares, user.id, friend.id, today) : 0
              const sharedToday = shares ? hasSharedToday(shares, user.id, friend.id, today) : false
              // A friend who already shared with ME today is always
              // shareable back, regardless of my own completion state —
              // matches FriendSharePickerModal.jsx's own gate exactly.
              const friendAlreadyShared = shares ? hasSharedToday(shares, friend.id, user.id, today) : false
              const incoming = incomingShares.find((s) => s.senderId === friend.id)
              return (
                <div key={friend.id} className="friend-picker-row">
                  <span className="share-friend-avatar">{friend.avatar || '👤'}</span>
                  <div className="share-friend-info">
                    {incoming ? (
                      <button type="button" className="share-friend-name-btn" onClick={() => handleViewShare(incoming)}>
                        @{friend.username}
                        <span className="friend-share-badge">1</span>
                      </button>
                    ) : (
                      <p className="share-friend-name">@{friend.username}</p>
                    )}
                    {shareStreak > 0 && <p className="share-friend-stat share-friend-stat--share">🔥 {shareStreak} day share streak</p>}
                  </div>
                  {sharedToday ? (
                    <span className="friend-picker-shared">✅ Shared today</span>
                  ) : !friendAlreadyShared && !canShareToday ? (
                    <p className="field-hint friend-picker-hint">Complete today's questions to share with @{friend.username}</p>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      disabled={sendingToId === friend.id}
                      onClick={() => handleShareWithFriend(friend.id)}
                    >
                      {sendingToId === friend.id ? 'Sharing…' : 'Share 🔥'}
                    </button>
                  )}
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
