'use client'

// Hard ceiling (3 MB) for every file the portal accepts. Mirrored server-side (the
// /api/upload route) and in the storage bucket's file_size_limit (migration 017).
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024
export const MAX_UPLOAD_LABEL = '3 MB'

// Photos of IDs and passports are fully readable at this size; it is what keeps
// the free/pro storage quota from being eaten by raw 3-6 MB phone shots.
const MAX_DIMENSION = 1600
const START_QUALITY = 0.82
const MIN_QUALITY = 0.5
// Aim well under the ceiling so a retry is rarely needed and storage stays small.
const TARGET_BYTES = 600 * 1024

export class UploadRejected extends Error {}

function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')) }
    img.src = url
  })
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/**
 * Prepare a user-selected file for upload:
 *  - images are resized (max 1600px) and re-encoded as JPEG, shrinking quality
 *    until they fit under the target, so uploads are small and never > 3 MB;
 *  - PDFs can't be recompressed in the browser, so they are only size-checked;
 *  - anything that is still over 3 MB is rejected with a clear message.
 * Throws UploadRejected (message is safe to show the user).
 */
export async function prepareUpload(file: File): Promise<File> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (isPdf) {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new UploadRejected(
        `This PDF is ${(file.size / 1048576).toFixed(1)} MB. Files must be ${MAX_UPLOAD_LABEL} or smaller — please upload a photo of the document instead, or a smaller scan.`
      )
    }
    return file
  }

  // Small, already-compressed JPEG/PNG/WebP: keep as is.
  if (file.size <= TARGET_BYTES && /^image\/(jpeg|png|webp)$/.test(file.type)) return file

  let bitmap: ImageBitmap | HTMLImageElement
  try {
    bitmap = await loadBitmap(file)
  } catch {
    // Undecodable (e.g. HEIC on a browser without support). Fine only if small.
    if (file.size <= MAX_UPLOAD_BYTES) return file
    throw new UploadRejected(
      `This image could not be processed and is over ${MAX_UPLOAD_LABEL}. Please save it as a JPG or PNG and try again.`
    )
  }

  const srcW = 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width
  const srcH = 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height
  const scale = Math.min(1, MAX_DIMENSION / Math.max(srcW, srcH))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(srcW * scale))
  canvas.height = Math.max(1, Math.round(srcH * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    if (file.size <= MAX_UPLOAD_BYTES) return file
    throw new UploadRejected(`Could not process this image. Please use a file under ${MAX_UPLOAD_LABEL}.`)
  }
  // JPEG has no alpha: paint white so transparent PNGs don't turn black.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  if ('close' in bitmap) bitmap.close()

  let quality = START_QUALITY
  let blob = await toBlob(canvas, quality)
  while (blob && blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
    quality = Math.round((quality - 0.08) * 100) / 100
    blob = await toBlob(canvas, quality)
  }
  if (!blob) {
    if (file.size <= MAX_UPLOAD_BYTES) return file
    throw new UploadRejected(`Could not process this image. Please use a file under ${MAX_UPLOAD_LABEL}.`)
  }
  // Never make a small file bigger.
  if (blob.size >= file.size && file.size <= MAX_UPLOAD_BYTES) return file
  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new UploadRejected(`This image is still over ${MAX_UPLOAD_LABEL} after compression. Please use a smaller photo.`)
  }

  const base = file.name.replace(/\.[^.]+$/, '') || 'upload'
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
}
