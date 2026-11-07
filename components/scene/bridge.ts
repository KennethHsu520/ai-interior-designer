import * as THREE from 'three'

export type ViewCommand = 'reset' | 'top' | 'forward' | 'back' | 'left' | 'right'

export const sceneBridge: {
  camera: THREE.Camera | null
  dom: HTMLElement | null
  view: ((cmd: ViewCommand) => void) | null
} = { camera: null, dom: null, view: null }

export function screenToFloor(clientX: number, clientY: number) {
  const { camera, dom } = sceneBridge
  if (!camera || !dom) return null
  const rect = dom.getBoundingClientRect()
  const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
  const ray = new THREE.Raycaster()
  ray.setFromCamera(ndc, camera)
  const p = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3())
  return p ? { x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 } : null
}
