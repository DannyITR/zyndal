import { gradeToBand } from '../../../lib/gradeReward'

const BAND_CLASS = { 'A+': 'grade-badge--a-plus', A: 'grade-badge--a', B: 'grade-badge--b', C: 'grade-badge--c' }

// Small colored pill for a percentage grade — green for A-range down to
// red for a fail, shared between the student uploads UI and the parent
// dashboard's test grades list.
export default function GradeBadge({ grade }) {
  const band = gradeToBand(grade)
  return <span className={`grade-badge ${band ? BAND_CLASS[band] : 'grade-badge--fail'}`}>{grade}%</span>
}
