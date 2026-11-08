'use client'

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type { CatalogItem } from '@/types/room'
import { loadPhoto, savePhoto, PHOTO_PREFIX } from './image'
import { buildProcedural } from './proceduralThree'

const SIZE = 160
const VERSION = 'v1'
const memory = new Map<string, string>()
const pending = new Map<string, Promise<string | null>>()
let queue: Promise<unknown> = Promise.resolve()
let renderer: THREE.WebGLRenderer | null = null
const loader = new GLTFLoader()
loader.setMeshoptDecoder(MeshoptDecoder)

function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setSize(SIZE, SIZE)
    renderer.setPixelRatio(1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
  }
  return renderer
}

export async function renderThumbnail(item: CatalogItem): Promise<string> {
  const model = item.procedural ? buildProcedural(item.procedural.kind, item.size, item.procedural.colors) : (await loader.loadAsync(item.file)).scene
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a8070', 2.2))
  const dir = new THREE.DirectionalLight('#ffffff', 2)
  dir.position.set(3, 5, 4)
  scene.add(dir)
  scene.add(model)
  const box = new THREE.Box3().setFromObject(model)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const r = Math.max(size.x, size.y, size.z)
  const cam = new THREE.PerspectiveCamera(30, 1, r / 100, r * 100)
  const dist = (r / 2 / Math.tan(THREE.MathUtils.degToRad(15))) * 1.15
  cam.position.copy(center).add(new THREE.Vector3(0.65, 0.55, 1).normalize().multiplyScalar(dist))
  cam.lookAt(center)
  const gl = getRenderer()
  gl.setClearColor(0x000000, 0)
  gl.render(scene, cam)
  const url = gl.domElement.toDataURL('image/png')
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && !item.procedural) {
      m.geometry.dispose()
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      mats.forEach((mat) => mat.dispose())
    }
  })
  model.userData.dispose?.()
  return url
}

function cacheId(item: CatalogItem) {
  if (!item.custom) return item.id
  const sig = JSON.stringify([item.size, item.procedural?.colors ?? null, item.file])
  let h = 0
  for (let i = 0; i < sig.length; i++) h = (h * 31 + sig.charCodeAt(i)) | 0
  return `${item.id}_${(h >>> 0).toString(36)}`
}

export function getThumbnail(item: CatalogItem): Promise<string | null> {
  if (item.thumbnail) return Promise.resolve(item.thumbnail)
  const id = cacheId(item)
  const cached = memory.get(id)
  if (cached) return Promise.resolve(cached)
  const p = pending.get(id)
  if (p) return p
  const key = `thumb_${VERSION}_${id}`
  const job = (async () => {
    const stored = await loadPhoto(`${PHOTO_PREFIX}${key}`)
    if (stored) {
      memory.set(id, stored)
      return stored
    }
    const run = queue.then(() => renderThumbnail(item))
    queue = run.catch(() => null)
    try {
      const url = await run
      memory.set(id, url)
      savePhoto(key, url).catch(() => {})
      return url
    } catch {
      return null
    }
  })()
  pending.set(id, job)
  return job
}
