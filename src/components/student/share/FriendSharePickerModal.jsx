import { useState } from 'react'
import { hasSharedToday, computeShareStreak } from '../../../lib/streakShare'

export default function FriendSharePickerModal({ user, friends, shares, sendingToId, onShare, onClose }) {
  const [query, setQuery] = useState('')

  const filtered = friends.filter(
    (f) => !query.trim() || f.username.toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card--friend-picker" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Share with Friends</h2>

        <input
          type="text"
          className="friend-picker-search"
          placeholder="Search friends by username..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {filtered.length === 0 ? (
          <p className="field-hint">
            {friends.length === 0 ? 'Add some friends first to share with them.' : 'No friends match your search.'}
          </p>
        ) : (
          <div className="friend-picker-list">
            {filtered.map((friend) => {
              const sharedToday = shares ? hasSharedToday(shares, user.id, friend.id) : false
              const shareStreak = shares ? computeShareStreak(shares, user.id, friend.id) : 0
              return (
                <div key={friend.id} className="friend-picker-row">
                  <span className="share-friend-avatar">{friend.avatar || '👤'}</span>
                  <div className="share-friend-info">
                    <p className="share-friend-name">@{friend.username}</p>
                    <p className="share-friend-stat share-friend-stat--share">↔️ {shareStreak} day share streak</p>
                  </div>
                  {sharedToday ? (
                    <span className="friend-picker-shared">✅ Shared today</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      disabled={sendingToId === friend.id}
                      onClick={() => onShare(friend.id)}
                    >
                      {sendingToId === friend.id ? 'Sharing…' : 'Share 🔥'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
