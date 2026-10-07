// Client-side helpers for turning an uploaded photo/PDF into the base64
// payload Claude's vision/document input expects, with a downscale pass so a
// full-resolution phone photo doesn't burn tokens (or blow past the API's
// per-request size limit) needlessly.

export const ACCEPTED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024 // 15MB — generous for a phone photo, well under the API's 32MB request cap

export function validateUploadFile(file) {
  if (!file) return 'No file selected.'
  if (!ACCEPTED_UPLOAD_TYPES.includes(file.type)) return 'Please upload a JPG, PNG, WEBP, or PDF file.'
  if (file.size > MAX_UPLOAD_BYTES) return 'File is too large — please use a photo or PDF under 15MB.'
  return null
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('Could not read the file.'))
    reader.readAsDataURL(file)
  })
}

// Plain base64 encode, no resizing — used for PDFs (and as a fallback).
export async function fileToBase64(file) {
  const dataUrl = await readAsDataUrl(file)
  const [, base64] = dataUrl.split(',')
  return { base64, mediaType: file.type }
}

const MAX_DIMENSION = 1568 // Claude's useful resolution ceiling for a single image tile
const JPEG_QUALITY = 0.85

// Downscales an image file to at most MAX_DIMENSION on its long edge and
// re-encodes as JPEG. Images already under the limit pass through as-is.
// alwaysReencode: re-encode as JPEG at `quality` even when no downscale is
// needed — used by encodeFilesWithinBudget below, where the point is to
// shrink the bytes, not just the dimensions.
export async function resizeImageToBase64(file, maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY, { alwaysReencode = false } = {}) {
  const dataUrl = await readAsDataUrl(file)

  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read this image — please try a different photo.'))
    img.src = dataUrl
  })

  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
  if (scale === 1 && !alwaysReencode) {
    const [, base64] = dataUrl.split(',')
    return { base64, mediaType: file.type || 'image/jpeg' }
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * scale)
  canvas.height = Math.round(image.height * scale)
  const ctx = canvas.getContext('2d')
  // JPEG has no alpha — without this a transparent PNG's background would
  // come out black.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  const resizedDataUrl = canvas.toDataURL('image/jpeg', quality)
  const [, base64] = resizedDataUrl.split(',')
  return { base64, mediaType: 'image/jpeg' }
}

// Vercel rejects any request body over ~4.5MB before the function runs, and
// every page of an upload travels in ONE request (see
// api/generate-from-document.js), so the whole set has to fit — not each
// page individually. Budget is in base64 characters, leaving headroom for
// the JSON around them.
const TOTAL_BASE64_BUDGET = 4_000_000

// Tried in order, only as far as needed: the first step is the normal
// single-photo encode, so a small upload is untouched; a 10-page set of
// phone photos typically settles one or two steps down, still comfortably
// legible for handwriting.
const ENCODE_STEPS = [
  { maxDimension: MAX_DIMENSION, quality: JPEG_QUALITY, alwaysReencode: false },
  { maxDimension: MAX_DIMENSION, quality: 0.7, alwaysReencode: true },
  { maxDimension: 1280, quality: 0.7, alwaysReencode: true },
  { maxDimension: 1100, quality: 0.65, alwaysReencode: true },
  { maxDimension: 900, quality: 0.6, alwaysReencode: true },
]

// Encodes every page of one upload to [{ base64, mediaType }], stepping
// image quality down until the set fits TOTAL_BASE64_BUDGET. PDFs are sent
// as-is (nothing here can shrink one), so a set that still doesn't fit at
// the lowest step throws err.code = 'UPLOAD_TOO_LARGE' instead of sending a
// request the platform would reject with an unhelpful error.
export async function encodeFilesWithinBudget(files) {
  const pdfs = new Map()
  for (const file of files) {
    if (file.type === 'application/pdf') pdfs.set(file, await fileToBase64(file))
  }

  let encoded = []
  for (const step of ENCODE_STEPS) {
    encoded = []
    for (const file of files) {
      encoded.push(pdfs.get(file) || (await resizeImageToBase64(file, step.maxDimension, step.quality, { alwaysReencode: step.alwaysReencode })))
    }
    const total = encoded.reduce((sum, f) => sum + f.base64.length, 0)
    if (total <= TOTAL_BASE64_BUDGET) return encoded
    if (pdfs.size === files.length) break
  }

  const err = new Error('These pages are too large to upload together — please split them into smaller uploads.')
  err.code = 'UPLOAD_TOO_LARGE'
  throw err
}
