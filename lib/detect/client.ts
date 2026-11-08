'use client'

import type { WallItemType } from '@/types/room'

export const DETECT_MODEL = { id: 'Xenova/owlv2-base-patch16-ensemble', upstream: 'google/owlv2-base-patch16-ensemble', license: 'Apache-2.0', sizeMB: '約 155 MB' }

const PROMPTS: { type: WallItemType; text: string }[] = [
  { type: 'door', text: 'a door' },
  { type: 'window', text: 'a window' },
  { type: 'switch', text: 'a light switch' },
  { type: 'outlet', text: 'a power outlet' },
  { type: 'light', text: 'a ceiling light' },
  { type: 'air_conditioner', text: 'an air conditioner' },
]

export type Suggestion = { id: string; type: WallItemType; score: number; x0: number; x1: number; y0: number; y1: number }

type Raw = { label: string; score: number; box: { xmin: number; ymin: number; xmax: number; ymax: number } }

type WorkerMsg =
  | { type: 'progress'; file: string; loaded: number; total: number }
  | { type: 'device'; device: 'webgpu' | 'wasm' }
  | { type: 'ready' }
  | { type: 'result'; id: number; items: Raw[] }
  | { type: 'error'; id: number; message: string }

export type DetectProgress = { phase: 'download' | 'running'; percent: number; device?: 'webgpu' | 'wasm' }

const CONSENT_KEY = 'detect-model-consent'

let worker: Worker | null = null
let seq = 0

export function detectionSupported() {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined'
}

export function hasConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1'
  } catch {
    return false
  }
}

export function giveConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, '1')
  } catch {}
}

function getWorker() {
  if (!worker) worker = new Worker(new URL('./detect.worker.ts', import.meta.url), { type: 'module' })
  return worker
}

function iou(a: Suggestion, b: { x0: number; x1: number; y0: number; y1: number }) {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0))
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))
  const inter = ix * iy
  const union = (a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - inter
  return union > 0 ? inter / union : 0
}

export function suppress(list: Suggestion[], existing: { x0: number; x1: number; y0: number; y1: number }[]) {
  const sorted = [...list].sort((a, b) => b.score - a.score)
  const kept: Suggestion[] = []
  for (const s of sorted) {
    if (kept.some((k) => iou(s, k) > 0.45)) continue
    if (existing.some((e) => iou(s, e) > 0.4)) continue
    kept.push(s)
  }
  return kept
}

export function detectObjects(image: string, threshold: number, onProgress: (p: DetectProgress) => void): Promise<Suggestion[]> {
  const w = getWorker()
  const id = ++seq
  const files = new Map<string, { loaded: number; total: number }>()
  let device: 'webgpu' | 'wasm' | undefined
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent<WorkerMsg>) => {
      const m = e.data
      if (m.type === 'device') device = m.device
      else if (m.type === 'progress') {
        files.set(m.file, { loaded: m.loaded, total: m.total })
        let loaded = 0
        let total = 0
        for (const f of files.values()) {
          loaded += f.loaded
          total += f.total
        }
        onProgress({ phase: 'download', percent: total ? Math.min(100, (loaded / total) * 100) : 0, device })
      } else if (m.type === 'ready') onProgress({ phase: 'running', percent: 100, device })
      else if (m.type === 'result' && m.id === id) {
        cleanup()
        const items = m.items
          .map((r) => {
            const prompt = PROMPTS.find((p) => p.text === r.label)
            if (!prompt) return null
            return {
              id: `sg_${id}_${Math.random().toString(36).slice(2, 8)}`,
              type: prompt.type,
              score: r.score,
              x0: Math.max(0, r.box.xmin),
              x1: Math.min(1, r.box.xmax),
              y0: Math.max(0, r.box.ymin),
              y1: Math.min(1, r.box.ymax),
            }
          })
          .filter((s): s is Suggestion => !!s && s.x1 > s.x0 && s.y1 > s.y0)
        resolve(items)
      } else if (m.type === 'error' && m.id === id) {
        cleanup()
        reject(new Error(m.message))
      }
    }
    const onError = (e: ErrorEvent) => {
      cleanup()
      worker?.terminate()
      worker = null
      reject(new Error(e.message || 'worker error'))
    }
    const cleanup = () => {
      w.removeEventListener('message', onMessage)
      w.removeEventListener('error', onError)
    }
    w.addEventListener('message', onMessage)
    w.addEventListener('error', onError)
    w.postMessage({ type: 'detect', id, image, labels: PROMPTS.map((p) => p.text), threshold })
  })
}
