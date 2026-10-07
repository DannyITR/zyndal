import { randomUUID } from 'node:crypto'
import { supabase } from './auth.js'

// Storage for the original page images/PDFs behind a Notes Calendar shared
// upload (see api/uploads/save-shared-upload.js). The bucket is PRIVATE with
// no storage.objects policies at all (see supabase/schema.sql), so the
// browser's anon key can never list or read it — every byte is written by,
// and every read URL is minted by, the service-role client here, and only
// ever after the calling endpoint has run its own getForumMembership check.
// That makes the membership check the single gate for images exactly as it
// already is for the upload's summary/questions.
export const SHARED_NOTES_BUCKET = 'shared-notes'

// How long a signed URL handed to a confirmed member stays loadable. Short
// enough that someone who leaves (or is removed from) a class loses access
// to anything they'd already been sent soon after, long enough that a
// student reading through a day's notes doesn't hit dead images mid-session
// — both screens re-request fresh URLs every time they're opened.
const SIGNED_URL_TTL_SECONDS = 60 * 60

export const STORABLE_MEDIA_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

// files: the same [{ base64, mediaType }] the safety screen just passed.
// Returns the [{ path, media_type }] list stored on uploads.shared_files.
// All-or-nothing: if any page fails, the ones already written are removed
// and the error is rethrown, so a shared upload never ends up with only
// some of its pages viewable.
export async function storeSharedNoteFiles({ classType, classId, files }) {
  const folder = `${classType}/${classId}/${randomUUID()}`
  const stored = []
  try {
    for (const [i, file] of files.entries()) {
      const path = `${folder}/${i + 1}.${STORABLE_MEDIA_TYPES[file.mediaType]}`
      const { error } = await supabase.storage
        .from(SHARED_NOTES_BUCKET)
        .upload(path, Buffer.from(file.base64, 'base64'), { contentType: file.mediaType, upsert: false })
      if (error) throw error
      stored.push({ path, media_type: file.mediaType })
    }
  } catch (err) {
    await removeSharedNoteFiles(stored)
    throw err
  }
  return stored
}

// Best-effort — a leftover object in a private bucket nobody can be handed
// a URL for anymore isn't worth failing the caller's own delete/rollback.
export async function removeSharedNoteFiles(sharedFiles) {
  const paths = (sharedFiles || []).map((f) => f.path).filter(Boolean)
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(SHARED_NOTES_BUCKET).remove(paths)
  if (error) console.error('[sharedNotes] failed to remove stored files:', error)
}

// Takes any number of uploads' shared_files arrays and signs every path in
// ONE storage round trip, returning a parallel array of
// [{ url, mediaType }] lists (page order preserved). A page whose URL
// couldn't be signed is dropped rather than failing the whole response —
// the summary is still worth showing without it. ONLY call this after the
// caller's membership in the upload's class has been confirmed.
export async function signSharedNoteFiles(sharedFilesLists) {
  const lists = sharedFilesLists.map((list) => (Array.isArray(list) ? list.filter((f) => f && f.path) : []))
  const paths = lists.flat().map((f) => f.path)
  if (paths.length === 0) return lists.map(() => [])

  const { data, error } = await supabase.storage.from(SHARED_NOTES_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
  if (error) {
    console.error('[sharedNotes] failed to sign file URLs:', error)
    return lists.map(() => [])
  }
  const urlByPath = {}
  for (const row of data || []) {
    if (row.signedUrl && !row.error) urlByPath[row.path] = row.signedUrl
  }

  return lists.map((list) => list.filter((f) => urlByPath[f.path]).map((f) => ({ url: urlByPath[f.path], mediaType: f.media_type })))
}
