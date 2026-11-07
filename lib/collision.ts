import type { CatalogItem, PlacedFurniture, Room, Vec2 } from '@/types/room'
import { furnitureDims } from './catalog'
import { doorSwingGeometry, isConvexVertex, pointInPolygon, segmentsIntersect, signedArea, wallPoint, wallSegment } from './geometry'

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

export function furnitureOBB(f: Pick<PlacedFurniture, 'position' | 'rotationY' | 'scale' | 'size'>, item: CatalogItem, shrink = EPS): OBB {
  const dims = furnitureDims(f, item)
  return {
    cx: f.position.x,
    cz: f.position.z,
    hw: Math.max(0.005, dims.width / 2 - shrink),
    hd: Math.max(0.005, dims.depth / 2 - shrink),
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

export const DOOR_APPROACH = 0.6

export function doorZones(room: Room): Vec2[][] {
  const zones: Vec2[][] = []
  room.walls.forEach((w, i) => {
    for (const it of w.items) {
      if (it.type !== 'door') continue
      const g = doorSwingGeometry(room.floor, i, it)
      if (g.swing.side === 'in') {
        if (g.swing.angle <= 180) zones.push(g.polygon)
      }
      const a = wallPoint(room.floor, i, it.offset)
      const b = wallPoint(room.floor, i, it.offset + it.width)
      const d = g.swing.side === 'in' ? Math.min(DOOR_APPROACH, it.width) : DOOR_APPROACH
      zones.push([a, b, { x: b.x + g.inward.x * d, z: b.z + g.inward.z * d }, { x: a.x + g.inward.x * d, z: a.z + g.inward.z * d }])
    }
  })
  return zones
}

function axesOf(poly: Vec2[]) {
  const out: Vec2[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const l = Math.hypot(dx, dz)
    if (l > 1e-9) out.push({ x: -dz / l, z: dx / l })
  }
  return out
}

export function convexOverlap(a: Vec2[], b: Vec2[]) {
  for (const axis of [...axesOf(a), ...axesOf(b)]) {
    const [amin, amax] = project(a, axis)
    const [bmin, bmax] = project(b, axis)
    if (amax <= bmin + 1e-6 || bmax <= amin + 1e-6) return false
  }
  return true
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
      if (doors.some((d) => convexOverlap(obbCorners(b.obb), d))) reasons.push('擋住門的開門範圍')
      boxes.forEach((o, j) => {
        if (!o || j === i || NO_COLLIDE.has(o.item.category)) return
        if (obbOverlap(b.obb, o.obb)) reasons.push(`與「${o.item.name}」重疊`)
      })
    }
    result.set(b.f.id, { ok: reasons.length === 0, reasons })
  })
  return result
}

function checkOne(room: Room, doors: Vec2[][], cand: PlacedFurniture, others: { item: CatalogItem; obb: OBB }[], item: CatalogItem) {
  const obb = furnitureOBB(cand, item)
  if (!obbInsideRoom(obb, room.floor)) return false
  if (NO_COLLIDE.has(item.category)) return true
  if (doors.some((d) => convexOverlap(obbCorners(obb), d))) return false
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

export function clampIntoRoom(floor: Vec2[], f: PlacedFurniture, item: CatalogItem, prev?: Vec2): PlacedFurniture['position'] {
  const at = (x: number, z: number) => ({ ...f, position: { x, y: 0, z } })
  const inside = (x: number, z: number) => obbInsideRoom(furnitureOBB(at(x, z), item), floor)
  const r3 = (v: number) => Math.round(v * 1000) / 1000
  if (inside(f.position.x, f.position.z)) return f.position
  const n = floor.length
  const sign = signedArea(floor) >= 0 ? 1 : -1
  const convex = floor.map((_, i) => isConvexVertex(floor, i) === sign > 0)
  let x = f.position.x
  let z = f.position.z
  for (let it = 0; it < 8; it++) {
    let moved = false
    for (let i = 0; i < n; i++) {
      const s = wallSegment(floor, i)
      const nx = s.normal.x * sign
      const nz = s.normal.z * sign
      const corners = obbCorners(furnitureOBB(at(x, z), item, 0))
      const dims = furnitureDims(f, item)
      const reach = Math.hypot(dims.width, dims.depth)
      const lo = convex[i] ? -reach : 0
      const hi = convex[(i + 1) % n] ? s.length + reach : s.length
      let worst = 0
      for (const c of corners) {
        const cl = Math.hypot(c.x - x, c.z - z) || 1
        if (pointInPolygon({ x: c.x - ((c.x - x) / cl) * 0.004, z: c.z - ((c.z - z) / cl) * 0.004 }, floor)) continue
        const t = (c.x - s.a.x) * s.dir.x + (c.z - s.a.z) * s.dir.z
        if (t < lo - 1e-6 || t > hi + 1e-6) continue
        const d = (c.x - s.a.x) * nx + (c.z - s.a.z) * nz
        if (d < worst && d > -reach) worst = d
      }
      if (worst < -1e-6) {
        x -= nx * worst
        z -= nz * worst
        moved = true
      }
    }
    if (!moved) break
  }
  if (inside(x, z)) return { x: r3(x), y: 0, z: r3(z) }
  if (prev && inside(prev.x, prev.z)) {
    let a = 0
    let b = 1
    for (let k = 0; k < 14; k++) {
      const m = (a + b) / 2
      if (inside(prev.x + (f.position.x - prev.x) * m, prev.z + (f.position.z - prev.z) * m)) a = m
      else b = m
    }
    return { x: r3(prev.x + (f.position.x - prev.x) * a), y: 0, z: r3(prev.z + (f.position.z - prev.z) * a) }
  }
  return f.position
}
