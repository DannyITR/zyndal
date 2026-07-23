export function averageGrade(grades) {
  if (!grades || grades.length === 0) return null
  return Math.round(grades.reduce((sum, g) => sum + g.grade_percentage, 0) / grades.length)
}

export function computeSubjectAverages(grades) {
  const bySubject = {}
  for (const g of grades) {
    if (!bySubject[g.subject]) bySubject[g.subject] = []
    bySubject[g.subject].push(g)
  }
  return Object.fromEntries(Object.entries(bySubject).map(([subject, list]) => [subject, averageGrade(list)]))
}

// green >= 80, yellow 60-79, red < 60
export function gradeBand(percentage) {
  if (percentage >= 80) return 'good'
  if (percentage >= 60) return 'mid'
  return 'bad'
}

// Compares the average of the earlier half of a student's grades (by test
// date) against the later half. A small ±3-point band counts as "steady" so
// noise from a single grade doesn't flip the label. Needs at least 2 grades
// to say anything at all.
export function computeTrend(grades) {
  if (!grades || grades.length < 2) return null
  const sorted = [...grades].sort((a, b) => a.test_date.localeCompare(b.test_date))
  const mid = Math.floor(sorted.length / 2) || 1
  const earlierAvg = averageGrade(sorted.slice(0, mid))
  const laterAvg = averageGrade(sorted.slice(mid))
  if (laterAvg == null) return null

  const diff = laterAvg - earlierAvg
  if (diff >= 3) return 'improving'
  if (diff <= -3) return 'declining'
  return 'steady'
}
