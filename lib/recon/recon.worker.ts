import { MeshoptSimplifier } from 'meshoptimizer'
import { marchingCubes } from './marching'

type OrtTensor = { data: Float32Array; dims: number[] }
type OrtSession = { run: (feeds: Record<string, unknown>) => Promise<Record<string, OrtTensor>>; release?: () => Promise<void>; inputNames: string[]; outputNames: string[] }
type Ort = {
  env: { wasm: { wasmPaths: string; numThreads: number } }
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => unknown
  InferenceSession: { create: (model: Uint8Array, options: Record<string, unknown>) => Promise<OrtSession> }
}

const ORT_VERSION = '1.30.0'
const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`
const TRIPOSR = 'https://huggingface.co/cgb/triposr-onnx-webgpu/resolve/main/'
const SEG = 'https://huggingface.co/BritishWerewolf/U-2-Netp/resolve/main/onnx/'
const CACHE = 'triposr-v1'
const GRID = 96
const ISO = 25
const BATCH = 65536
const TARGET_TRIANGLES = 20000
const SEG_SIZE = 320
const MAX_SIDE = 1024
const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

const FILES: Record<string, { url: string; size: number }> = {
  'triplane_q8.onnx': { url: TRIPOSR + 'triplane_q8.onnx', size: 900_000 },
  'triplane_q8.onnx.data': { url: TRIPOSR + 'triplane_q8.onnx.data', size: 483_800_000 },
  'decoder.onnx': { url: TRIPOSR + 'decoder.onnx', size: 200_000 },
  'u2netp.onnx': { url: SEG + 'model.onnx', size: 4_500_000 },
}

type Msg = { type: 'run'; image: string }

const post = (m: Record<string, unknown>, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer)
const stage = (name: string, percent: number) => post({ type: 'stage', stage: name, percent })

async function cacheDir() {
  try {
    const root = await navigator.storage.getDirectory()
    return await root.getDirectoryHandle(CACHE, { create: true })
  } catch {
    return null
  }
}

async function readCached(name: string) {
  const dir = await cacheDir()
  if (!dir) return null
  try {
    const file = await (await dir.getFileHandle(name)).getFile()
    if (file.size < FILES[name].size * 0.9) return null
    return new Uint8Array(await file.arrayBuffer())
  } catch {
    return null
  }
}

async function writeCached(name: string, data: Uint8Array) {
  const dir = await cacheDir()
  if (!dir) return
  try {
    const handle = await dir.getFileHandle(name, { create: true })
    const writable = await handle.createWritable()
    await writable.write(data.slice().buffer)
    await writable.close()
  } catch {
    try {
      await dir.removeEntry(name)
    } catch {}
  }
}

async function fetchCached(name: string, onProgress: (loaded: number, total: number) => void): Promise<Uint8Array> {
  const hit = await readCached(name)
  if (hit) {
    onProgress(hit.byteLength, hit.byteLength)
    return hit
  }
  const res = await fetch(FILES[name].url)
  if (!res.ok || !res.body) throw new Error(`下載模型失敗（${res.status}），請確認網路連線`)
  const total = Number(res.headers.get('content-length')) || FILES[name].size
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength
    onProgress(loaded, total)
  }
  const out = new Uint8Array(loaded)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.byteLength
  }
  await writeCached(name, out)
  return out
}

async function loadImage(url: string) {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob())
  const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * k))
  const h = Math.max(1, Math.round(bitmap.height * k))
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  const seg = new OffscreenCanvas(SEG_SIZE, SEG_SIZE)
  seg.getContext('2d')!.drawImage(bitmap, 0, 0, SEG_SIZE, SEG_SIZE)
  bitmap.close()
  return { w, h, rgba: ctx.getImageData(0, 0, w, h).data, segRgba: seg.getContext('2d')!.getImageData(0, 0, SEG_SIZE, SEG_SIZE).data }
}

async function removeBackground(ort: Ort, model: Uint8Array, img: Awaited<ReturnType<typeof loadImage>>) {
  stage('segment', 0)
  const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] })
  const n = SEG_SIZE * SEG_SIZE
  let peak = 1
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) peak = Math.max(peak, img.segRgba[i * 4 + c])
  const input = new Float32Array(3 * n)
  for (let i = 0; i < n; i++)
    for (let c = 0; c < 3; c++) input[c * n + i] = (img.segRgba[i * 4 + c] / peak - MEAN[c]) / STD[c]
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SEG_SIZE, SEG_SIZE]) })
  const pred = out[session.outputNames[0]].data
  await session.release?.()
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < n; i++) {
    if (pred[i] < lo) lo = pred[i]
    if (pred[i] > hi) hi = pred[i]
  }
  const range = hi - lo || 1
  const maskCanvas = new OffscreenCanvas(SEG_SIZE, SEG_SIZE)
  const mctx = maskCanvas.getContext('2d')!
  const md = mctx.createImageData(SEG_SIZE, SEG_SIZE)
  for (let i = 0; i < n; i++) {
    const a = ((pred[i] - lo) / range) * 255
    md.data[i * 4] = a
    md.data[i * 4 + 1] = a
    md.data[i * 4 + 2] = a
    md.data[i * 4 + 3] = 255
  }
  mctx.putImageData(md, 0, 0)
  const scaled = new OffscreenCanvas(img.w, img.h)
  const sctx = scaled.getContext('2d')!
  sctx.drawImage(maskCanvas, 0, 0, img.w, img.h)
  const sd = sctx.getImageData(0, 0, img.w, img.h).data
  const alpha = new Uint8Array(img.w * img.h)
  for (let i = 0; i < alpha.length; i++) alpha[i] = sd[i * 4]
  return alpha
}

function prepare(img: Awaited<ReturnType<typeof loadImage>>, alpha: Uint8Array) {
  const { w, h, rgba } = img
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  let fg = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (alpha[y * w + x] > 127) {
        fg++
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
  const ratio = fg / (w * h)
  if (maxX < 0 || ratio < 0.01 || ratio > 0.97) throw new Error('去背失敗：找不到明確的主體，請換一張背景單純、家具完整入鏡的照片')
  const side = Math.max(maxX - minX + 1, maxY - minY + 1) / 0.85
  const cx = (minX + maxX + 1) / 2
  const cy = (minY + maxY + 1) / 2
  const S = 512
  const out = new Float32Array(3 * S * S)
  for (let py = 0; py < S; py++)
    for (let px = 0; px < S; px++) {
      const sx = cx + ((px + 0.5) / S - 0.5) * side - 0.5
      const sy = cy + ((py + 0.5) / S - 0.5) * side - 0.5
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      const x0 = Math.floor(sx)
      const y0 = Math.floor(sy)
      const fx = sx - x0
      const fy = sy - y0
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const x = x0 + dx
          const y = y0 + dy
          if (x < 0 || y < 0 || x >= w || y >= h) continue
          const wt = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy)
          const i = y * w + x
          const al = (alpha[i] / 255) * wt
          r += (rgba[i * 4] / 255) * al
          g += (rgba[i * 4 + 1] / 255) * al
          b += (rgba[i * 4 + 2] / 255) * al
          a += al
        }
      const o = py * S + px
      out[o] = r + (1 - a) * 0.5
      out[S * S + o] = g + (1 - a) * 0.5
      out[2 * S * S + o] = b + (1 - a) * 0.5
    }
  return out
}

function sampleFeatures(tri: Float32Array, pts: Float32Array, count: number, out: Float32Array) {
  const C = 40
  const H = 64
  const W = 64
  const HW = H * W
  const planeSize = C * HW
  out.fill(0, 0, count * 120)
  for (let n = 0; n < count; n++) {
    const px = pts[n * 3]
    const py = pts[n * 3 + 1]
    const pz = pts[n * 3 + 2]
    for (let p = 0; p < 3; p++) {
      const u = p === 2 ? py : px
      const v = p === 0 ? py : pz
      const fx = ((u + 1) * W - 1) / 2
      const fy = ((v + 1) * H - 1) / 2
      const x0 = Math.floor(fx)
      const y0 = Math.floor(fy)
      const ax = fx - x0
      const ay = fy - y0
      const base = p * planeSize
      const o = n * 120 + p * C
      for (let t = 0; t < 4; t++) {
        const tx = x0 + (t & 1)
        const ty = y0 + (t >> 1)
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue
        const wt = (t & 1 ? ax : 1 - ax) * (t >> 1 ? ay : 1 - ay)
        if (wt === 0) continue
        const off = base + ty * W + tx
        for (let c = 0; c < C; c++) out[o + c] += tri[off + c * HW] * wt
      }
    }
  }
}

async function run(imageUrl: string) {
  stage('download-model', 0)
  const ort = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${ORT_BASE}ort.webgpu.min.mjs`)) as Ort
  ort.env.wasm.wasmPaths = ORT_BASE
  const progress: Record<string, [number, number]> = {}
  const names = Object.keys(FILES)
  const report = (name: string) => (loaded: number, total: number) => {
    progress[name] = [loaded, total]
    const l = names.reduce((s, f) => s + (progress[f]?.[0] ?? 0), 0)
    const t = names.reduce((s, f) => s + (progress[f]?.[1] || FILES[f].size), 0)
    stage('download-model', (l / t) * 100)
  }
  const [graph, data, decoderBytes, segBytes] = await Promise.all(names.map((n) => fetchCached(n, report(n))))

  const img = await loadImage(imageUrl)
  const alpha = await removeBackground(ort, segBytes, img)
  const input = prepare(img, alpha)

  stage('encode', 0)
  const triplaneSession = await ort.InferenceSession.create(graph, {
    executionProviders: ['webgpu'],
    externalData: [{ path: 'triplane_q8.onnx.data', data }],
  })
  const triOut = await triplaneSession.run({ [triplaneSession.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, 512, 512]) })
  const triplane = triOut[triplaneSession.outputNames[0]].data.slice()
  await triplaneSession.release?.()

  const decoder = await ort.InferenceSession.create(decoderBytes, { executionProviders: ['webgpu', 'wasm'] })
  const total = GRID * GRID * GRID
  const density = new Float32Array(total)
  const colors = new Float32Array(total * 3)
  const pts = new Float32Array(BATCH * 3)
  const feats = new Float32Array(BATCH * 120)
  const coord = (i: number) => (i / (GRID - 1)) * 2 - 1
  for (let start = 0; start < total; start += BATCH) {
    const count = Math.min(BATCH, total - start)
    for (let k = 0; k < count; k++) {
      const g = start + k
      pts[k * 3] = coord(Math.floor(g / (GRID * GRID)))
      pts[k * 3 + 1] = coord(Math.floor(g / GRID) % GRID)
      pts[k * 3 + 2] = coord(g % GRID)
    }
    sampleFeatures(triplane, pts, count, feats)
    const out = await decoder.run({ features: new ort.Tensor('float32', feats.subarray(0, count * 120), [count, 120]) })
    density.set(out.density.data.subarray(0, count), start)
    colors.set(out.color.data.subarray(0, count * 3), start * 3)
    stage('mesh', ((start + count) / total) * 100)
  }
  await decoder.release?.()

  const mesh = marchingCubes(density, colors, GRID, ISO)
  if (mesh.indices.length < 300) throw new Error('沒有產生出形狀，請換一張主體更清楚的照片')
  stage('simplify', 0)
  await MeshoptSimplifier.ready
  let indices = mesh.indices
  if (indices.length / 3 > TARGET_TRIANGLES) {
    const [simplified] = MeshoptSimplifier.simplify(indices, mesh.positions, 3, TARGET_TRIANGLES * 3, 0.01, ['LockBorder'])
    indices = simplified
  }
  post({ type: 'done', positions: mesh.positions, colors: mesh.colors, indices }, [mesh.positions.buffer, mesh.colors.buffer, indices.buffer])
}

self.onmessage = async (e: MessageEvent<Msg>) => {
  if (e.data.type !== 'run') return
  try {
    await run(e.data.image)
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
