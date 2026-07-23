import { supabase } from './supabaseClient'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I

function randomCode(length = 6) {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return code
}

export async function generateParentCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode()
    const { data, error } = await supabase.from('users').select('id').eq('parent_code', code).maybeSingle()
    if (error) throw error
    if (!data) return code
  }
  throw new Error('Could not generate a unique parent code. Please try again.')
}
