import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { clearClassLeave } from '../_lib/classLeaves.js'

function validate(body) {
  if (!body.group_id || typeof body.group_id !== 'string') {
    return { field: 'group_id', message: 'group_id is required.' }
  }
  return null
}

async function handle({ userId, body }) {
  const { error } = await supabase.from('school_subject_group_students').insert({ group_id: body.group_id, student_id: userId })
  // Matches join-class.js's own duplicate-join handling — already being a
  // member is a success from the caller's point of view, not an error.
  if (error && error.code !== '23505') throw error
  await clearClassLeave(userId, 'group', body.group_id)
  return { joined: true }
}

export default createStudentHandler({ method: 'POST', validate, handle })
