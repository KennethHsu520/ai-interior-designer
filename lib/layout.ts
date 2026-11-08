import type { Room } from '@/types/room'
import { bbox, signedArea } from './geometry'

export function facingAngle(nx: number, nz: number) {
  return Math.atan2(nx, nz)
}

export function roomCentroid(room: Room) {
  const f = room.floor
  const a = signedArea(f)
  if (Math.abs(a) < 1e-6) {
    const b = bbox(f)
    return { x: b.cx, z: b.cz }
  }
  let cx = 0
  let cz = 0
  for (let i = 0; i < f.length; i++) {
    const p = f[i]
    const q = f[(i + 1) % f.length]
    const cross = p.x * q.z - q.x * p.z
    cx += (p.x + q.x) * cross
    cz += (p.z + q.z) * cross
  }
  return { x: cx / (6 * a), z: cz / (6 * a) }
}
