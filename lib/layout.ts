import { furnitureDims } from './catalog'
import type { CatalogItem, PlacedFurniture, Room } from '@/types/room'
import { bbox, signedArea, wallPoint, wallSegment } from './geometry'
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
