// Pure domain logic for the multi-page upload flow, separate from storage.js
// (Supabase I/O) and ai.js (Claude calls).

export const MAX_UPLOAD_PAGES = 5

export function formatShortDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
