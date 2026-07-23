// Standard percentage bands for the grade-based payout feature. Below 60%
// intentionally has no band — no automatic bonus is suggested (the parent
// can still pay manually from Finances).
export function gradeToBand(gradePercent) {
  if (gradePercent >= 90) return 'A+'
  if (gradePercent >= 80) return 'A'
  if (gradePercent >= 70) return 'B'
  if (gradePercent >= 60) return 'C'
  return null
}

// settings: { gradeRewardAPlusCents, gradeRewardACents, gradeRewardBCents, gradeRewardCCents }
export function computeSuggestedBonusCents(gradePercent, settings) {
  const band = gradeToBand(gradePercent)
  switch (band) {
    case 'A+':
      return settings.gradeRewardAPlusCents ?? 0
    case 'A':
      return settings.gradeRewardACents ?? 0
    case 'B':
      return settings.gradeRewardBCents ?? 0
    case 'C':
      return settings.gradeRewardCCents ?? 0
    default:
      return 0
  }
}
