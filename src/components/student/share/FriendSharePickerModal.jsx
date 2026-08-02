import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { hasSharedToday, computeShareStreak } from '../../../lib/streakShare'

export default function FriendSharePickerModal({ user, friends, shares, today, sendingToId, canShareToday, onShare, onClose }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')

  const filtered = friends.filter(
    (f) => !query.trim() || f.username.toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card--friend-picker" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{t('share.pickerTitle')}</h2>

        <input
          type="text"
          className="friend-picker-search"
          placeholder={t('common.searchByUsername')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {filtered.length === 0 ? (
          <p className="field-hint">
            {friends.length === 0 ? t('share.addFriendsFirst') : t('share.noMatch')}
          </p>
        ) : (
          <div className="friend-picker-list">
            {filtered.map((friend) => {
              const sharedToday = shares ? hasSharedToday(shares, user.id, friend.id, today) : false
              const shareStreak = shares ? computeShareStreak(shares, user.id, friend.id, today) : 0
              return (
                <div key={friend.id} className="friend-picker-row">
                  <span className="share-friend-avatar">{friend.avatar || '👤'}</span>
                  <div className="share-friend-info">
                    <p className="share-friend-name">@{friend.username}</p>
                    {shareStreak > 0 && <p className="share-friend-stat share-friend-stat--share">{t('friends.shareStreakDay', { count: shareStreak })}</p>}
                  </div>
                  {sharedToday ? (
                    <span className="friend-picker-shared">{t('common.sharedTodayBadge')}</span>
                  ) : !canShareToday ? (
                    // No exception for reciprocal shares — a friend having
                    // already shared with this user today does not bypass
                    // the completion requirement, matching share-score.js's
                    // own server-side check exactly.
                    <p className="field-hint friend-picker-hint">{t('common.completeToShareWith', { username: friend.username })}</p>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      disabled={sendingToId === friend.id}
                      onClick={() => onShare(friend.id)}
                    >
                      {sendingToId === friend.id ? t('common.sending') : t('common.shareCta')}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
            {t('common.done')}
          </button>
        </div>
      </div>
    </div>
  )
}
