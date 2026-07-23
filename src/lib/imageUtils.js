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
export async function resizeImageToBase64(file, maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY) {
  const dataUrl = await readAsDataUrl(file)

  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read this image — please try a different photo.'))
    img.src = dataUrl
  })

  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
  if (scale === 1) {
    const [, base64] = dataUrl.split(',')
    return { base64, mediaType: file.type || 'image/jpeg' }
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * scale)
  canvas.height = Math.round(image.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  const resizedDataUrl = canvas.toDataURL('image/jpeg', quality)
  const [, base64] = resizedDataUrl.split(',')
  return { base64, mediaType: 'image/jpeg' }
}
