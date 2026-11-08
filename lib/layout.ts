import { furnitureDims } from './catalog'
import type { CatalogItem, PlacedFurniture, Room, WallItem } from '@/types/room'
import { bbox, doorSwingGeometry, signedArea, wallPoint, wallSegment } from './geometry'
import { resolveAll } from './collision'

export function facingAngle(nx: number, nz: number) {
  return Math.atan2(nx, nz)
}

const CENTER_CATEGORIES = new Set(['地毯', '桌'])

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

export function heuristicLayout(room: Room, list: PlacedFurniture[], catalog: Map<string, CatalogItem>) {
  const center = roomCentroid(room)
  const walls = room.floor
    .map((_, i) => ({ i, seg: wallSegment(room.floor, i), wall: room.walls[i] }))
    .sort((a, b) => b.seg.length - a.seg.length)
  const cursor = new Map<number, number>()
  const items = [...list].sort((a, b) => {
    const ia = catalog.get(a.catalogId)
    const ib = catalog.get(b.catalogId)
    return (ib ? ib.size.width * ib.size.depth : 0) - (ia ? ia.size.width * ia.size.depth : 0)
  })
  let wallPick = 0
  const out = items.map((f) => {
    const item = catalog.get(f.catalogId)
    if (!item) return f
    if (CENTER_CATEGORIES.has(item.category)) return { ...f, position: { x: center.x, y: 0, z: center.z }, rotationY: 0 }
    for (let k = 0; k < walls.length; k++) {
      const w = walls[(wallPick + k) % walls.length]
      const used = cursor.get(w.i) ?? 0.1
      const { width, depth } = furnitureDims(f, item)
      const blocked = (w.wall?.items ?? []).filter((it) => it.type === 'door' || (it.type === 'window' && it.elevation < furnitureDims(f, item).height))
      let start = used
      for (const b of blocked.sort((a, c) => a.offset - c.offset)) {
        if (start + width > b.offset && start < b.offset + b.width) start = b.offset + b.width + 0.05
      }
      if (start + width <= w.seg.length - 0.05) {
        cursor.set(w.i, start + width + 0.1)
        wallPick = (wallPick + k + 1) % walls.length
        const p = wallPoint(room.floor, w.i, start + width / 2, depth / 2 + 0.03)
        return { ...f, position: { x: p.x, y: 0, z: p.z }, rotationY: facingAngle(w.seg.normal.x, w.seg.normal.z) }
      }
    }
    return { ...f, position: { x: center.x, y: 0, z: center.z } }
  })
  const ordered = list.map((f) => out.find((o) => o.id === f.id) ?? f)
  return resolveAll(room, ordered, catalog)
}

function doorForAI(room: Room, i: number, it: WallItem) {
  const g = doorSwingGeometry(room.floor, i, it, 8)
  const a = wallPoint(room.floor, i, it.offset)
  const b = wallPoint(room.floor, i, it.offset + it.width)
  const r = (p: { x: number; z: number }) => ({ x: +p.x.toFixed(2), z: +p.z.toFixed(2) })
  const approach = 0.6
  const front = [a, b, { x: b.x + g.inward.x * approach, z: b.z + g.inward.z * approach }, { x: a.x + g.inward.x * approach, z: a.z + g.inward.z * approach }]
  return {
    swing: { hinge: r(g.hinge), opensInto: g.swing.side === 'in' ? 'room' : 'outside', angleDeg: g.swing.angle, radius: +it.width.toFixed(2) },
    clearZones: (g.swing.side === 'in' ? [g.polygon, front] : [front]).map((z) => z.map(r)),
  }
}

export function describeRoomForAI(room: Room) {
  return {
    unit: 'meter',
    height: room.height,
    floorPolygon: room.floor.map((p) => ({ x: +p.x.toFixed(3), z: +p.z.toFixed(3) })),
    walls: room.floor.map((_, i) => {
      const s = wallSegment(room.floor, i)
      const w = room.walls[i]
      return {
        wall: i + 1,
        start: { x: +s.a.x.toFixed(3), z: +s.a.z.toFixed(3) },
        end: { x: +s.b.x.toFixed(3), z: +s.b.z.toFixed(3) },
        length: +s.length.toFixed(3),
        inwardNormal: { x: +s.normal.x.toFixed(3), z: +s.normal.z.toFixed(3) },
        facingIntoRoomRotationY: +facingAngle(s.normal.x, s.normal.z).toFixed(4),
        items: (w?.items ?? []).map((it) => {
          const c = wallPoint(room.floor, i, it.offset + it.width / 2)
          return {
            type: it.type,
            label: it.label,
            center: { x: +c.x.toFixed(3), z: +c.z.toFixed(3) },
            width: +it.width.toFixed(2),
            elevation: +it.elevation.toFixed(2),
            height: +it.height.toFixed(2),
            ...(it.type === 'door' ? doorForAI(room, i, it) : {}),
          }
        }),
      }
    }),
    ceilingItems: room.ceilingItems.map((c) => ({ type: c.type, label: c.label, x: +c.x.toFixed(2), z: +c.z.toFixed(2), width: +c.width.toFixed(2), depth: +c.depth.toFixed(2) })),
  }
}
