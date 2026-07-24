// ---------------------------------------------------------------------------
// Client-side image helpers: read a File, downscale it (to keep the upload and
// the model's image-token cost reasonable), and return a base64 data URL.
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

/**
 * Downscale an image data URL so its long edge is at most MAX_EDGE, re-encoding
 * as JPEG. Returns a new data URL. If the image is already small, it's just
 * re-encoded (which also normalizes HEIC/PNG/etc. to JPEG).
 */
export function downscaleDataUrl(dataUrl, maxEdge = MAX_EDGE, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const { width, height } = img
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
    img.onerror = () => reject(new Error('Could not decode the image'))
    img.src = dataUrl
  })
}

/** Split a data URL into its media type and raw base64 payload. */
export function splitDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || '')
  if (!m) throw new Error('Unexpected image format')
  return { mediaType: m[1], base64: m[2] }
}

/** Full pipeline: File → downscaled JPEG data URL. */
export async function prepareImage(file) {
  const raw = await fileToDataUrl(file)
  return downscaleDataUrl(raw)
}
