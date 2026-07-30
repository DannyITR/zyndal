import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'

function validate(body) {
  if (!body.share_id) return 'share_id is required.'
  return null
}

async function handle({ userId, body }) {
  const { data: share, error: fetchError } = await supabase
    .from('streak_shares')
    .select('id, receiver_id')
    .eq('id', body.share_id)
    .maybeSingle()
  if (fetchError) throw fetchError
  if (!share) {
    const err = new Error('Share not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  if (share.receiver_id !== userId) {
    const err = new Error('This share is not addressed to you.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }

  const { error } = await supabase.from('streak_shares').update({ seen_at: new Date().toISOString() }).eq('id', body.share_id)
  if (error) throw error
  return { marked: true }
}

export default createStudentHandler({ method: 'POST', validate, handle })
