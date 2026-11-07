const DB_NAME = 'ai-interior-photos'
const STORE = 'photos'
export const PHOTO_PREFIX = 'idb:'

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void }

function looksHeic(file: Blob) {
  const name = file instanceof File ? file.name : ''
  return /heic|heif/i.test(file.type) || /\.(heic|heif|hif)$/i.test(name)
}

async function heicToJpeg(file: Blob) {
  const { heicTo } = await import('heic-to/next')
  return heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 })
}

async function decode(file: Blob): Promise<Decoded> {
  if (looksHeic(file)) {
    try {
      return await decodeNative(await heicToJpeg(file))
    } catch {}
  }
  try {
    return await decodeNative(file)
  } catch {
    if (looksHeic(file)) throw new Error('decode')
    return decodeNative(await heicToJpeg(file))
  }
}

async function decodeNative(file: Blob): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) }
    } catch {
      URL.revokeObjectURL(url)
      throw new Error('decode')
    }
  }
}

export async function compressImage(file: Blob, maxSide = 1600, quality = 0.85): Promise<string> {
  const img = await decode(file)
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img.source, 0, 0, w, h)
  img.close()
  return canvas.toDataURL('image/jpeg', quality)
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function savePhoto(key: string, dataUrl: string) {
  await tx('readwrite', (s) => s.put(dataUrl, key))
  return `${PHOTO_PREFIX}${key}`
}

export async function loadPhoto(ref: string | undefined): Promise<string | null> {
  if (!ref) return null
  if (!ref.startsWith(PHOTO_PREFIX)) return ref
  try {
    const v = await tx<string | undefined>('readonly', (s) => s.get(ref.slice(PHOTO_PREFIX.length)) as IDBRequest<string | undefined>)
    return v ?? null
  } catch {
    return null
  }
}

export async function deletePhoto(ref: string | undefined) {
  if (!ref || !ref.startsWith(PHOTO_PREFIX)) return
  try {
    await tx('readwrite', (s) => s.delete(ref.slice(PHOTO_PREFIX.length)))
  } catch {}
}
