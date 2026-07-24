// ---------------------------------------------------------------------------
// Client-side image helpers: read a File (including iPhone HEIC/HEIF), downscale
// it (to keep the upload and the model's image-token cost reasonable), and
// return a base64 JPEG data URL that the Anthropic API accepts.
// ---------------------------------------------------------------------------

const MAX_EDGE = 2000 // px on the long edge — plenty for reading handwriting

/** Read a File/Blob into a data URL. */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read the file'))
    reader.readAsDataURL(file)
  })
}

/** True for HEIC/HEIF files, which most browsers cannot decode natively. */
function isHeic(file) {
  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  return (
    type === 'image/heic' ||
    type === 'image/heif' ||
    type === 'image/heic-sequence' ||
    type === 'image/heif-sequence' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  )
}

/** Convert a HEIC/HEIF File into a JPEG Blob using heic2any (loaded on demand). */
async function heicToJpegBlob(file) {
  try {
    const heic2any = (await import('heic2any')).default
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
    return Array.isArray(out) ? out[0] : out
  } catch (err) {
    throw new Error(
      'That looks like a HEIC photo and it could not be converted. On iPhone you can set ' +
        'Settings → Camera → Formats → "Most Compatible", or export the photo as JPG.',
    )
  }
}

/**
 * Downscale an image data URL so its long edge is at most MAX_EDGE, re-encoding
 * as JPEG. Returns a new data URL. Small images are simply re-encoded (which
 * also normalizes PNG/WebP/GIF to JPEG).
 */
export function downscaleDataUrl(dataUrl, maxEdge = MAX_EDGE, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const { width, height } = img
      if (!width || !height) {
        reject(new Error('The image appears to be empty or corrupted.'))
        return
      }
      const scale = Math.min(1, maxEdge / Math.max(width, height))
      const w = Math.round(width * scale)
      const h = Math.round(height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () =>
      reject(new Error('Could not decode the image. Try a JPG, PNG, WebP, or HEIC photo.'))
    img.src = dataUrl
  })
}

/** Split a data URL into its media type and raw base64 payload. */
export function splitDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || '')
  if (!m) throw new Error('Unexpected image format')
  return { mediaType: m[1], base64: m[2] }
}

/**
 * Full pipeline: File → (HEIC→JPEG if needed) → downscaled JPEG data URL.
 */
export async function prepareImage(file) {
  const source = isHeic(file) ? await heicToJpegBlob(file) : file
  const raw = await fileToDataUrl(source)
  return downscaleDataUrl(raw)
}
