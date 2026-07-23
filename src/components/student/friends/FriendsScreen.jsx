import { useEffect, useState } from 'react'
import {
  searchStudentsByUsername,
  sendFriendRequest,
  getPendingFriendRequests,
  respondToFriendRequest,
  getFriendsWithStreaks,
} from '../../../lib/storage'
import TopBar from '../../shared/TopBar'
import FriendRequestBanner from './FriendRequestBanner'

export default function FriendsScreen({ user, onBack, onLogout, onLogoClick }) {
  const [pendingRequests, setPendingRequests] = useState(null)
  const [friends, setFriends] = useState(null)

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState(null)
  const [searchError, setSearchError] = useState('')
  const [requestStatusById, setRequestStatusById] = useState({}) // studentId -> 'sending' | 'sent' | error message

  async function refreshFriendsData() {
    const [pending, friendList] = await Promise.all([getPendingFriendRequests(user.id), getFriendsWithStreaks(user.id)])
    setPendingRequests(pending)
    setFriends(friendList)
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([getPendingFriendRequests(user.id), getFriendsWithStreaks(user.id)]).then(([pending, friendList]) => {
      if (cancelled) return
      setPendingRequests(pending)
      setFriends(friendList)
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

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
            {friends.map((friend) => (
              <div key={friend.id} className="finance-student-row">
                <div>
                  <p className="finance-student-name">@{friend.username}</p>
                  <p className="finance-student-detail">🔥 {friend.streak} day streak</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
