'use client'

import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

export const RECON_DOWNLOAD = '約 490 MB（TripoSR 485 MB＋去背模型 U²-Net 5 MB）'

export type ReconStage = 'download-model' | 'download-seg' | 'segment' | 'encode' | 'mesh' | 'simplify'
export type ReconProgress = { stage: ReconStage; percent: number }
export type ReconMesh = { positions: Float32Array; colors: Float32Array; indices: Uint32Array }

export const STAGE_LABEL: Record<ReconStage, string> = {
  'download-model': '下載 3D 生成模型',
  'download-seg': '下載去背模型',
  segment: '照片去背',
  encode: '分析照片形狀',
  mesh: '建立 3D 網格',
  simplify: '簡化面數',
}

export async function reconSupported(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof window === 'undefined') return { ok: false }
  const ua = navigator.userAgent
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024)) return { ok: false, reason: '手機與平板不支援' }
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (mem !== undefined && mem < 4) return { ok: false, reason: '記憶體不足' }
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: (o?: unknown) => Promise<{ limits: { maxBufferSize: number } } | null> } }).gpu
  if (!gpu) return { ok: false, reason: '瀏覽器不支援 WebGPU' }
  try {
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' })
    if (!adapter) return { ok: false, reason: '找不到可用的顯示卡' }
    if (adapter.limits.maxBufferSize < 256 * 1024 * 1024) return { ok: false, reason: '顯示卡記憶體不足' }
    return { ok: true }
  } catch {
    return { ok: false, reason: '無法使用顯示卡' }
  }
}

export function runRecon(image: string, onProgress: (p: ReconProgress) => void, signal: AbortSignal): Promise<ReconMesh> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./recon.worker.ts', import.meta.url), { type: 'module' })
    const finish = () => {
      signal.removeEventListener('abort', abort)
      worker.terminate()
    }
    const abort = () => {
      finish()
      reject(new DOMException('canceled', 'AbortError'))
    }
    signal.addEventListener('abort', abort)
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data
      if (m.type === 'stage') onProgress({ stage: m.stage, percent: m.percent })
      else if (m.type === 'done') {
        finish()
        resolve({ positions: m.positions, colors: m.colors, indices: m.indices })
      } else if (m.type === 'error') {
        finish()
        reject(new Error(m.message))
      }
    }
    worker.onerror = (e) => {
      finish()
      reject(new Error(e.message || '執行失敗'))
    }
    worker.postMessage({ type: 'run', image })
  })
}

export function buildMeshObject(mesh: ReconMesh, size: { width: number; depth: number; height: number }) {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions.slice(), 3))
  geo.setAttribute('color', new THREE.BufferAttribute(mesh.colors.slice(), 3))
  geo.setIndex(new THREE.BufferAttribute(mesh.indices.slice(), 1))
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
  geo.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI / 2))
  geo.computeBoundingBox()
  const box = geo.boundingBox!
  const ext = box.getSize(new THREE.Vector3())
  geo.translate(-(box.min.x + ext.x / 2), -box.min.y, -(box.min.z + ext.z / 2))
  geo.scale(size.width / (ext.x || 1), size.height / (ext.y || 1), size.depth / (ext.z || 1))
  geo.computeVertexNormals()
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 })
  const obj = new THREE.Mesh(geo, material)
  obj.name = 'generated'
  return obj
}

export async function meshToGlbDataUrl(obj: THREE.Object3D) {
  const exporter = new GLTFExporter()
  const buffer = (await exporter.parseAsync(obj, { binary: true })) as ArrayBuffer
  const bytes = new Uint8Array(buffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:model/gltf-binary;base64,${btoa(bin)}`
}
