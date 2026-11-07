'use client'

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
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

function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setSize(SIZE, SIZE)
    renderer.setPixelRatio(1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
  }
  return renderer
}

async function render(item: CatalogItem): Promise<string> {
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

export function getThumbnail(item: CatalogItem): Promise<string | null> {
  const cached = memory.get(item.id)
  if (cached) return Promise.resolve(cached)
  const p = pending.get(item.id)
  if (p) return p
  const key = `thumb_${VERSION}_${item.id}`
  const job = (async () => {
    const stored = await loadPhoto(`${PHOTO_PREFIX}${key}`)
    if (stored) {
      memory.set(item.id, stored)
      return stored
    }
    const run = queue.then(() => render(item))
    queue = run.catch(() => null)
    try {
      const url = await run
      memory.set(item.id, url)
      savePhoto(key, url).catch(() => {})
      return url
    } catch {
      return null
    }
  })()
  pending.set(item.id, job)
  return job
}
