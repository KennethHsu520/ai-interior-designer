const HOUR_MS = 60 * 60 * 1000
const SWEEP_EVERY_MS = 5 * 60 * 1000

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
let lastSweep = 0

function sweep(now: number) {
  if (now - lastSweep < SWEEP_EVERY_MS) return
  lastSweep = now
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key)
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  if (first) return first
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

export function limitFromEnv(name: string, fallback: number) {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback
}

export type RateResult = { ok: true } | { ok: false; retryAfter: number }

export function hitRateLimit(scope: string, request: Request, limit: number, windowMs = HOUR_MS): RateResult {
  const now = Date.now()
  sweep(now)
  const key = `${scope}:${clientIp(request)}`
  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }
  if (b.count >= limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) }
  b.count += 1
  return { ok: true }
}

export function tooManyRequests(retryAfter: number) {
  const minutes = Math.max(1, Math.ceil(retryAfter / 60))
  return Response.json(
    { error: `呼叫太頻繁，請 ${minutes} 分鐘後再試`, retryAfter },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}

export class BodyTooLargeError extends Error {}

export async function readJsonLimited(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError()
  if (!request.body) throw new Error('empty body')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new BodyTooLargeError()
    }
    chunks.push(value)
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    merged.set(c, offset)
    offset += c.byteLength
  }
  return JSON.parse(new TextDecoder().decode(merged))
}
