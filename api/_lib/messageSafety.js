import { supabase } from './auth.js'
import { generateJson } from './anthropic.js'

// Narrowly scoped on purpose — general rudeness, arguments, and profanity
// are already handled by src/lib/profanityFilter.js's block-and-warn check
// at send time; this only exists to catch three specific safety concerns
// profanity filtering can't (a perfectly clean sentence can still describe
// self-harm or a threat). Deliberately biased toward sensitivity, not
// precision, for self_harm specifically — a false positive just adds one
// row to an admin queue, a false negative could miss a real cry for help.
const SAFETY_SYSTEM_PROMPT = `You are a safety screener for private direct messages between students on an educational platform. Screen ONLY for these three narrow categories:

1. self_harm — the message mentions or references self-harm, suicide, or self-injury, in any way (about the sender, the recipient, or anyone else), including indirect or passing references. Err on the side of flagging when in doubt.
2. sexual_content_minors — the message contains sexual content involving a minor, implicit or explicit.
3. threats — the message contains a genuine threat of violence or harm to the sender, the recipient, or anyone else.

Do NOT flag general rudeness, insults, arguments, sarcasm, swearing, or normal teenage conflict — those are handled separately and are out of scope here. Only flag a clear, genuine match for one of the three categories above. If the message doesn't match any of them, set flagged to false and category to null.

Return only JSON: { flagged: boolean, category: "self_harm" | "sexual_content_minors" | "threats" | null, reason: string (one short sentence explaining why, or empty string if not flagged) }`

const MESSAGE_SAFETY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    flagged: { type: 'boolean' },
    category: { type: ['string', 'null'] },
    reason: { type: 'string' },
  },
  required: ['flagged', 'category', 'reason'],
}

const VALID_CATEGORIES = ['self_harm', 'sexual_content_minors', 'threats']

// Called via waitUntil from api/messages/send-message.js, after the
// message has already been inserted and delivered — this never blocks or
// delays sending; it only ever adds a row to message_reports for admin
// review afterward. Failure here is logged by the caller and otherwise
// silent — a screening miss must never surface as a user-facing error on
// an already-sent message.
export async function screenMessageSafety(messageId, body) {
  const result = await generateJson({
    system: SAFETY_SYSTEM_PROMPT,
    schema: MESSAGE_SAFETY_SCHEMA,
    maxTokens: 200,
    content: [{ type: 'text', text: body }],
  })

  if (!result.flagged || !VALID_CATEGORIES.includes(result.category)) return

  const { error } = await supabase.from('message_reports').insert({
    target_type: 'message',
    target_id: messageId,
    reporter_id: null,
    source: 'ai',
    category: result.category,
    reason: result.reason || 'Flagged by automated safety screening.',
    status: 'pending',
  })
  if (error) throw error
}
