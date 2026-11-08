'use client'

import { WebIO, type Document } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, getBounds, meshopt, prune, weld } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { measureBounds, type ModelMeasure } from './modelMeasure'

const MAX_TEXTURE = 1024

let ioPromise: Promise<WebIO> | null = null

function getIO() {
  if (!ioPromise)
    ioPromise = (async () => {
      await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready])
      return new WebIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
    })()
  return ioPromise
}

async function encodeCanvas(bitmap: ImageBitmap, w: number, h: number, mime: string) {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(w, h)
    c.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
    return c.convertToBlob({ type: mime, quality: 0.85 })
  }
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  return new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), mime, 0.85))
}

async function resizeTextures(doc: Document, max: number) {
  for (const tex of doc.getRoot().listTextures()) {
    const image = tex.getImage()
    const mime = tex.getMimeType()
    if (!image || (mime !== 'image/png' && mime !== 'image/jpeg')) continue
    const bitmap = await createImageBitmap(new Blob([image.slice()], { type: mime }))
    const longest = Math.max(bitmap.width, bitmap.height)
    if (longest <= max) {
      bitmap.close()
      continue
    }
    const k = max / longest
    const blob = await encodeCanvas(bitmap, Math.round(bitmap.width * k), Math.round(bitmap.height * k), mime)
    bitmap.close()
    tex.setImage(new Uint8Array(await blob.arrayBuffer()))
  }
}

export type ProcessedModel = { bytes: Uint8Array; measure: ModelMeasure; before: number; after: number; triangles: number }

export async function processGlb(file: File): Promise<ProcessedModel> {
  const io = await getIO()
  const input = new Uint8Array(await file.arrayBuffer())
  const doc = await io.readBinary(input)
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]
  if (!scene) throw new Error('這個檔案沒有任何場景')
  const { min, max } = getBounds(scene)
  if (!Number.isFinite(min[0]) || !Number.isFinite(max[0])) throw new Error('讀不到模型的範圍，檔案可能是空的')
  const measure = measureBounds(min, max)
  let triangles = 0
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices()
      const pos = prim.getAttribute('POSITION')
      triangles += Math.round((idx ? idx.getCount() : pos ? pos.getCount() : 0) / 3)
    }
  await resizeTextures(doc, MAX_TEXTURE)
  await doc.transform(dedup(), prune(), weld(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  const bytes = await io.writeBinary(doc)
  return { bytes, measure, before: input.byteLength, after: bytes.byteLength, triangles }
}

export async function sha256Hex(data: Uint8Array | ArrayBuffer) {
  const buf = data instanceof Uint8Array ? data.slice().buffer : data
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
