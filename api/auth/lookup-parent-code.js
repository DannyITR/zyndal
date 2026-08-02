import { createPublicHandler } from '../_lib/publicHandler.js'
import { supabase } from '../_lib/auth.js'

// Public GET, called by the landing/signup screen when it detects
// ?parent_code=... in the URL (see App.jsx) — just enough to show "@[parent]
// invited you to Zyndal!" before the visitor has an account. Only exposes
// the parent's username (already effectively public — searchable by any
// student via the Friends screen), nothing else.
function validate(body) {
  if (!body.code || typeof body.code !== 'string' || !body.code.trim()) return 'code is required.'
  return null
}

async function handle({ body }) {
  const code = body.code.trim().toUpperCase()
  const { data: parent, error } = await supabase
    .from('users')
    .select('username')
    .eq('parent_code', code)
    .eq('account_type', 'parent')
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return { username: parent?.username || null }
}

export default createPublicHandler({ method: 'GET', validate, handle })
