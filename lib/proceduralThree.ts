import * as THREE from 'three'
import { proceduralParts, ROLE_DEFAULTS, type Role } from './procedural'

const unitBox = new THREE.BoxGeometry(1, 1, 1)
const unitSphere = new THREE.SphereGeometry(1, 20, 14)
const cylCache = new Map<string, THREE.CylinderGeometry>()

function cylinder(rt: number, rb: number) {
  const ratio = rb > 0 ? Math.round((rt / rb) * 100) / 100 : 1
  const key = String(ratio)
  let g = cylCache.get(key)
  if (!g) {
    g = new THREE.CylinderGeometry(ratio, 1, 1, 28)
    cylCache.set(key, g)
  }
  return g
}

function material(role: Role, color: string) {
  const c = new THREE.Color(color)
  switch (role) {
    case 'metal':
      return new THREE.MeshStandardMaterial({ color: c, metalness: 0.65, roughness: 0.35 })
    case 'glass':
      return new THREE.MeshStandardMaterial({ color: c, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false })
    case 'light':
      return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2 })
    case 'screen':
      return new THREE.MeshStandardMaterial({ color: c, metalness: 0.3, roughness: 0.15 })
    case 'wood':
      return new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })
    case 'leaf':
      return new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true })
    default:
      return new THREE.MeshStandardMaterial({ color: c, roughness: 0.88 })
  }
}

export function buildProcedural(kind: string, size: { width: number; depth: number; height: number }, colors: Record<string, string>) {
  const group = new THREE.Group()
  const mats = new Map<Role, THREE.Material>()
  const mat = (role: Role) => {
    let m = mats.get(role)
    if (!m) {
      m = material(role, colors[role] ?? ROLE_DEFAULTS[role])
      mats.set(role, m)
    }
    return m
  }
  for (const part of proceduralParts(kind, size)) {
    let mesh: THREE.Mesh
    if (part.s === 'box') {
      mesh = new THREE.Mesh(unitBox, mat(part.c))
      mesh.scale.set(Math.max(part.d[0], 0.001), Math.max(part.d[1], 0.001), Math.max(part.d[2], 0.001))
    } else if (part.s === 'sph') {
      mesh = new THREE.Mesh(unitSphere, mat(part.c))
      mesh.scale.set(part.d[0], part.d[1], part.d[2])
    } else {
      const [rt, h, rb] = part.d
      mesh = new THREE.Mesh(cylinder(rt, rb), mat(part.c))
      mesh.scale.set(rb, Math.max(h, 0.001), rb)
    }
    mesh.position.set(part.p[0], part.p[1], part.p[2])
    if (part.r) mesh.rotation.set(part.r[0], part.r[1], part.r[2])
    mesh.castShadow = part.c !== 'glass'
    mesh.receiveShadow = true
    group.add(mesh)
  }
  group.userData.dispose = () => mats.forEach((m) => m.dispose())
  return group
}
