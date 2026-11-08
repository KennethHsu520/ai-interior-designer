import { env, pipeline, RawImage } from '@huggingface/transformers'

type DetectRequest = { type: 'detect'; id: number; image: string; labels: string[]; threshold: number }
type Box = { xmin: number; ymin: number; xmax: number; ymax: number }
type Output = { label: string; score: number; box: Box }
type Detector = (image: RawImage, labels: string[], options: { threshold: number; percentage: boolean }) => Promise<Output[]>

const MODEL = 'Xenova/owlv2-base-patch16-ensemble'

env.allowLocalModels = false

let detector: Promise<Detector> | null = null

function load() {
  if (!detector) {
    detector = (async () => {
      self.postMessage({ type: 'device', device: 'wasm' })
      const pipe = await pipeline('zero-shot-object-detection', MODEL, {
        device: 'wasm',
        dtype: 'q8',
        progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
          if (p.status === 'progress' && p.file) self.postMessage({ type: 'progress', file: p.file, loaded: p.loaded ?? 0, total: p.total ?? 0 })
        },
      })
      return pipe as unknown as Detector
    })()
    detector.catch(() => {
      detector = null
    })
  }
  return detector
}

self.onmessage = async (e: MessageEvent<DetectRequest>) => {
  const msg = e.data
  if (msg.type !== 'detect') return
  try {
    const run = await load()
    self.postMessage({ type: 'ready' })
    const image = await RawImage.read(msg.image)
    const out = await run(image, msg.labels, { threshold: msg.threshold, percentage: true })
    self.postMessage({ type: 'result', id: msg.id, items: out })
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.id, message: err instanceof Error ? err.message : String(err) })
  }
}
