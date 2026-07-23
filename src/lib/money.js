// rate is "coins per dollar" (e.g. 10 means 10 coins = $1).
export function coinsToCents(coins, rate) {
  if (!rate) return 0
  return Math.round((coins * 100) / rate)
}

// Inverse of coinsToCents — used for bonuses, which add coins to a student
// rather than cash out existing ones.
export function centsToCoins(cents, rate) {
  if (!rate) return 0
  return Math.round((cents * rate) / 100)
}

export function centsToDisplay(cents) {
  return ((cents || 0) / 100).toFixed(2)
}
