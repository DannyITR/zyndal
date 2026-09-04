import { createStudentHandler } from '../_lib/studentHandler.js'
import { listConversationsForUser } from '../_lib/messaging.js'

// createStudentHandler is role-agnostic (any authenticated session — see
// its own header comment) — student, parent, and teacher accounts all
// reach this the same way; api/_lib/messaging.js's permission matrix is
// what actually decides who each of a caller's conversations can be with.
async function handle({ userId }) {
  return listConversationsForUser(userId)
}

export default createStudentHandler({ method: 'GET', handle })
