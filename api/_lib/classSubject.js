import { SUBJECTS } from '../../src/lib/questions.js'

// A teacher-claim-flow class always has classes.subject set directly
// (copied from its group at approval time — see resolve-teacher-claim.js).
// A legacy class from the older join-by-teacher-code flow
// (api/teacher/create-class.js) never captured a subject at all, so this
// falls back to matching one of the 6 canonical subject names against its
// free-text name — the only signal it carries. Returns null if neither
// resolves, meaning the class can't be placed on any subject-scoped screen.
export function resolveClassSubject(classRow) {
  return classRow.subject || SUBJECTS.find((s) => classRow.name.toLowerCase().includes(s.name.toLowerCase()))?.id || null
}
