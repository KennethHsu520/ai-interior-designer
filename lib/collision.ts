import type { CatalogItem, PlacedFurniture, Room, Vec2 } from '@/types/room'
import { pointInPolygon, segmentsIntersect, wallPoint, wallSegment } from './geometry'

export type OBB = { cx: number; cz: number; hw: number; hd: number; angle: number }

const EPS = 0.01
const NO_COLLIDE = new Set(['地毯', '裝飾'])

export function obbCorners(b: OBB): Vec2[] {
  const c = Math.cos(b.angle)
  const s = Math.sin(b.angle)
  return [
    [-b.hw, -b.hd],
    [b.hw, -b.hd],
    [b.hw, b.hd],
    [-b.hw, b.hd],
  ].map(([lx, lz]) => ({ x: b.cx + lx * c + lz * s, z: b.cz - lx * s + lz * c }))
}

export function furnitureOBB(f: Pick<PlacedFurniture, 'position' | 'rotationY' | 'scale'>, item: CatalogItem, shrink = EPS): OBB {
  return {
    cx: f.position.x,
    cz: f.position.z,
    hw: Math.max(0.005, (item.size.width * f.scale) / 2 - shrink),
    hd: Math.max(0.005, (item.size.depth * f.scale) / 2 - shrink),
    angle: f.rotationY,
  }
}

function project(corners: Vec2[], axis: Vec2) {
  let min = Infinity
  let max = -Infinity
  for (const p of corners) {
    const d = p.x * axis.x + p.z * axis.z
    if (d < min) min = d
    if (d > max) max = d
  }
  return [min, max] as const
}

export function obbOverlap(a: OBB, b: OBB) {
  const ca = obbCorners(a)
  const cb = obbCorners(b)
  const axes: Vec2[] = [a.angle, b.angle].flatMap((ang) => [
    { x: Math.cos(ang), z: -Math.sin(ang) },
    { x: Math.sin(ang), z: Math.cos(ang) },
  ])
  for (const axis of axes) {
    const [amin, amax] = project(ca, axis)
    const [bmin, bmax] = project(cb, axis)
    if (amax <= bmin || bmax <= amin) return false
  }
  return true
}

export function obbInsideRoom(b: OBB, floor: Vec2[]) {
  const corners = obbCorners(b)
  if (!corners.every((p) => pointInPolygon(p, floor))) return false
  for (let i = 0; i < floor.length; i++) {
    const a = floor[i]
    const c = floor[(i + 1) % floor.length]
    for (let j = 0; j < 4; j++) {
      if (segmentsIntersect(a, c, corners[j], corners[(j + 1) % 4])) return false
    }
  }
  return true
}

export function doorZones(room: Room): OBB[] {
  const zones: OBB[] = []
  room.walls.forEach((w, i) => {
    const seg = wallSegment(room.floor, i)
    for (const it of w.items) {
      if (it.type !== 'door') continue
      const depth = Math.min(Math.max(it.width, 0.6), 1.0)
      const center = wallPoint(room.floor, i, it.offset + it.width / 2, depth / 2)
      zones.push({ cx: center.x, cz: center.z, hw: it.width / 2, hd: depth / 2, angle: seg.angle })
    }
  })
  return zones
}

export type CollisionResult = { ok: boolean; reasons: string[] }

export function checkFurniture(
  room: Room,
  list: PlacedFurniture[],
  catalog: Map<string, CatalogItem>,
): Map<string, CollisionResult> {
  const result = new Map<string, CollisionResult>()
  const doors = doorZones(room)
  const boxes = list.map((f) => {
    const item = catalog.get(f.catalogId)
    return item ? { f, item, obb: furnitureOBB(f, item) } : null
  })
  boxes.forEach((b, i) => {
    if (!b) return
    const reasons: string[] = []
    if (!obbInsideRoom(b.obb, room.floor)) reasons.push('穿牆或超出房間')
    const exempt = NO_COLLIDE.has(b.item.category)
    if (!exempt) {
      if (doors.some((d) => obbOverlap(b.obb, d))) reasons.push('擋住門的開門範圍')
      boxes.forEach((o, j) => {
        if (!o || j === i || NO_COLLIDE.has(o.item.category)) return
        if (obbOverlap(b.obb, o.obb)) reasons.push(`與「${o.item.name}」重疊`)
      })
    }
    result.set(b.f.id, { ok: reasons.length === 0, reasons })
  })
  return result
}

function checkOne(room: Room, doors: OBB[], cand: PlacedFurniture, others: { item: CatalogItem; obb: OBB }[], item: CatalogItem) {
  const obb = furnitureOBB(cand, item)
  if (!obbInsideRoom(obb, room.floor)) return false
  if (NO_COLLIDE.has(item.category)) return true
  if (doors.some((d) => obbOverlap(obb, d))) return false
  return !others.some((o) => !NO_COLLIDE.has(o.item.category) && obbOverlap(obb, o.obb))
}

export function findFreeSpot(
  room: Room,
  target: PlacedFurniture,
  others: PlacedFurniture[],
  catalog: Map<string, CatalogItem>,
): PlacedFurniture | null {
  const item = catalog.get(target.catalogId)
  if (!item) return null
  const doors = doorZones(room)
  const otherBoxes = others.flatMap((o) => {
    const it = catalog.get(o.catalogId)
    return it ? [{ item: it, obb: furnitureOBB(o, it) }] : []
  })
  const step = 0.1
  const rotations = [target.rotationY, target.rotationY + Math.PI / 2, target.rotationY + Math.PI, target.rotationY - Math.PI / 2]
  for (let r = 0; r <= 40; r++) {
    for (const rot of rotations) {
      const ring: [number, number][] = []
      if (r === 0) ring.push([0, 0])
      else
        for (let k = -r; k <= r; k++) {
          ring.push([k, -r], [k, r])
          if (k !== -r && k !== r) ring.push([-r, k], [r, k])
        }
      for (const [dx, dz] of ring) {
        const cand: PlacedFurniture = {
          ...target,
          rotationY: rot,
          position: { ...target.position, x: target.position.x + dx * step, z: target.position.z + dz * step },
        }
        if (checkOne(room, doors, cand, otherBoxes, item)) return cand
      }
    }
  }
  return null
}

export function resolveAll(room: Room, list: PlacedFurniture[], catalog: Map<string, CatalogItem>) {
  const placed: PlacedFurniture[] = []
  const failed: string[] = []
  const ordered = [...list].sort((a, b) => {
    const ia = catalog.get(a.catalogId)
    const ib = catalog.get(b.catalogId)
    const aa = ia ? ia.size.width * ia.size.depth : 0
    const ab = ib ? ib.size.width * ib.size.depth : 0
    return ab - aa
  })
  for (const f of ordered) {
    const res = checkFurniture(room, [...placed, f], catalog).get(f.id)
    if (res?.ok) {
      placed.push(f)
      continue
    }
    const fixed = findFreeSpot(room, f, placed, catalog)
    if (fixed) placed.push(fixed)
    else {
      placed.push(f)
      failed.push(f.id)
    }
  }
  return { list: list.map((f) => placed.find((p) => p.id === f.id) ?? f), failed }
}

export function snapAngle(a: number, stepDeg = 15) {
  const step = (stepDeg * Math.PI) / 180
  return Math.round(a / step) * step
}
