'use client'

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { loadPhoto, PHOTO_PREFIX } from './image'

const resolved = new Map<string, Promise<string | null>>()

export function isStoredModel(file: string) {
  return file.startsWith(PHOTO_PREFIX)
}

export function resolveModelUrl(file: string): Promise<string | null> {
  if (!isStoredModel(file)) return Promise.resolve(file || null)
  let p = resolved.get(file)
  if (!p) {
    p = (async () => {
      const data = await loadPhoto(file)
      if (!data) return null
      const blob = await (await fetch(data)).blob()
      return URL.createObjectURL(new Blob([blob], { type: 'model/gltf-binary' }))
    })()
    resolved.set(file, p)
  }
  return p
}

function toDataUrl(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:model/gltf-binary;base64,${btoa(bin)}`
}

export async function objectToGlbDataUrl(obj: THREE.Object3D) {
  const buffer = (await new GLTFExporter().parseAsync(obj, { binary: true })) as ArrayBuffer
  return toDataUrl(buffer)
}

export async function resizeStoredModel(file: string, size: { width: number; depth: number; height: number }) {
  const url = await resolveModelUrl(file)
  if (!url) throw new Error('找不到生成的模型')
  const gltf = await new GLTFLoader().loadAsync(url)
  const root = gltf.scene
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const ext = box.getSize(new THREE.Vector3())
  const holder = new THREE.Group()
  const inner = new THREE.Group()
  inner.add(root)
  inner.position.set(-(box.min.x + ext.x / 2), -box.min.y, -(box.min.z + ext.z / 2))
  holder.add(inner)
  holder.scale.set(size.width / (ext.x || 1), size.height / (ext.y || 1), size.depth / (ext.z || 1))
  return objectToGlbDataUrl(holder)
}
