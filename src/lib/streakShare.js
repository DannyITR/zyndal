import { todayStr } from './streak'

export function hasSharedToday(shares, userId, friendId, today = todayStr()) {
  return shares.some((s) => s.sender_id === userId && s.receiver_id === friendId && s.share_date === today)
}

// Snapchat-style mutual streak: counts unbroken consecutive calendar days
// where BOTH people shared with each other. Starts counting from today if
// today is already complete (both shared), otherwise from yesterday — today
// isn't "broken" just because the day isn't over yet. Stops at the first day
// missing either side.
export function computeShareStreak(shares, userAId, userBId, today = todayStr()) {
  const sendersByDate = {}
  for (const s of shares) {
    const isThisPair =
      (s.sender_id === userAId && s.receiver_id === userBId) ||
      (s.sender_id === userBId && s.receiver_id === userAId)
    if (!isThisPair) continue
    if (!sendersByDate[s.share_date]) sendersByDate[s.share_date] = new Set()
    sendersByDate[s.share_date].add(s.sender_id)
  }

  function bothSharedOn(date) {
    const senders = sendersByDate[date]
    return Boolean(senders && senders.has(userAId) && senders.has(userBId))
  }

  const cursor = new Date(today + 'T00:00:00Z')
  if (!bothSharedOn(today)) cursor.setUTCDate(cursor.getUTCDate() - 1)

  let streak = 0
  while (bothSharedOn(cursor.toISOString().slice(0, 10))) {
    streak++
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}
