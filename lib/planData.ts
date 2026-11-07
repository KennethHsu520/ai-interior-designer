import type { CatalogItem, PlacedFurniture, Room, Vec2, WallItem } from '@/types/room'
import { itemTypeInfo } from '@/types/room'
import { furnitureColors, furnitureDims } from './catalog'
import { checkFurniture, furnitureOBB, obbCorners, obbInsideRoom, obbOverlap, type OBB } from './collision'
import { bbox, cornerAngle, doorSwingGeometry, signedArea, wallSegment } from './geometry'
import { roleLabel, type Role } from './procedural'

export const WALL_T = 0.12
export const PING = 3.3058

export const cm = (m: number) => Math.round(m * 100)

export type Tagged<T> = T & { tag: string; wallIndex: number }

export function tagWallItems(room: Room) {
  const doors: Tagged<WallItem>[] = []
  const windows: Tagged<WallItem>[] = []
  const electric: Tagged<WallItem>[] = []
  const others: Tagged<WallItem>[] = []
  room.walls.forEach((w, i) => {
    ;[...w.items]
      .sort((a, b) => a.offset - b.offset)
      .forEach((it) => {
        if (it.type === 'door') doors.push({ ...it, tag: `D${doors.length + 1}`, wallIndex: i })
        else if (it.type === 'window') windows.push({ ...it, tag: `W${windows.length + 1}`, wallIndex: i })
        else if (it.type === 'switch' || it.type === 'outlet' || it.type === 'light' || it.type === 'air_conditioner')
          electric.push({ ...it, tag: `E${electric.length + 1}`, wallIndex: i })
        else others.push({ ...it, tag: `X${others.length + 1}`, wallIndex: i })
      })
  })
  return { doors, windows, electric, others }
}

function pointSegDist(p: Vec2, a: Vec2, b: Vec2) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const l2 = dx * dx + dz * dz || 1
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2))
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t))
}

export function wallDistances(room: Room, f: PlacedFurniture, item: CatalogItem) {
  const corners = obbCorners(furnitureOBB(f, item, 0))
  const sign = signedArea(room.floor) < 0 ? -1 : 1
  return room.floor
    .map((_, i) => {
      const s = wallSegment(room.floor, i)
      const nx = s.normal.x * sign
      const nz = s.normal.z * sign
      let minPerp = Infinity
      let facing = false
      for (const c of corners) {
        const t = (c.x - s.a.x) * s.dir.x + (c.z - s.a.z) * s.dir.z
        const d = (c.x - s.a.x) * nx + (c.z - s.a.z) * nz
        if (t >= -0.01 && t <= s.length + 0.01) facing = true
        minPerp = Math.min(minPerp, d)
      }
      const segDist = Math.min(...corners.map((c) => pointSegDist(c, s.a, s.b)))
      return { wall: i, distance: Math.max(0, facing ? minPerp : segDist), facing }
    })
    .filter((d) => d.facing)
    .sort((a, b) => a.distance - b.distance)
}

export type Clearance = { id: string; text: string }

const NO_BLOCK = new Set(['地毯', '裝飾'])

function zoneFront(f: PlacedFurniture, item: CatalogItem, depth: number): OBB {
  const d = furnitureDims(f, item)
  const fx = Math.sin(f.rotationY)
  const fz = Math.cos(f.rotationY)
  const off = d.depth / 2 + depth / 2
  return { cx: f.position.x + fx * off, cz: f.position.z + fz * off, hw: d.width / 2 - 0.02, hd: depth / 2 - 0.01, angle: f.rotationY }
}

function zoneSide(f: PlacedFurniture, item: CatalogItem, width: number, side: 1 | -1): OBB {
  const d = furnitureDims(f, item)
  const rx = Math.cos(f.rotationY)
  const rz = -Math.sin(f.rotationY)
  const off = d.width / 2 + width / 2
  return { cx: f.position.x + rx * off * side, cz: f.position.z + rz * off * side, hw: width / 2 - 0.01, hd: d.depth * 0.35, angle: f.rotationY }
}

export function clearanceIssues(room: Room, list: PlacedFurniture[], catalog: Map<string, CatalogItem>) {
  const issues = new Map<string, string[]>()
  const boxes = list.flatMap((f) => {
    const item = catalog.get(f.catalogId)
    return item && !NO_BLOCK.has(item.category) ? [{ f, item, obb: furnitureOBB(f, item) }] : []
  })
  const free = (zone: OBB, selfId: string) => obbInsideRoom(zone, room.floor) && !boxes.some((b) => b.f.id !== selfId && obbOverlap(zone, b.obb))
  for (const f of list) {
    const item = catalog.get(f.catalogId)
    if (!item) continue
    const out: string[] = []
    const kind = item.procedural?.kind ?? item.id
    if (item.category === '床') {
      if (!free(zoneSide(f, item, 0.6, 1), f.id) && !free(zoneSide(f, item, 0.6, -1), f.id)) out.push('床的兩側都不足 60 cm，上下床與整理床鋪會很不方便')
      if (!free(zoneFront(f, item, 0.5), f.id)) out.push('床尾前方不足 50 cm')
    } else if (item.category === '櫃' && !/shelf|rack|toy/.test(kind)) {
      const need = /wardrobe|衣櫃/.test(kind + item.name) ? 0.9 : 0.7
      if (!free(zoneFront(f, item, need), f.id)) out.push(`正前方不足 ${cm(need)} cm，門片或抽屜無法完全打開`)
    } else if (item.category === '桌' && /desk|vanity|書桌|化妝/.test(kind + item.name)) {
      if (!free(zoneFront(f, item, 0.75), f.id)) out.push('座位區不足 75 cm，椅子拉不出來')
    } else if (item.category === '家電' && /fridge|washer|冰箱|洗衣/.test(kind + item.name)) {
      if (!free(zoneFront(f, item, 0.8), f.id)) out.push('前方不足 80 cm，門無法完全打開')
    } else if (item.category === '沙發' && !/beanbag|ottoman|pouf/.test(kind)) {
      if (!free(zoneFront(f, item, 0.35), f.id)) out.push('座位前方不足 35 cm，腿部空間太擠')
    } else if (item.category === '衛浴' && /toilet|馬桶/.test(kind + item.name)) {
      if (!free(zoneFront(f, item, 0.6), f.id)) out.push('馬桶前方不足 60 cm')
    }
    if (out.length) issues.set(f.id, out)
  }
  return issues
}

export function furnitureSchedule(room: Room, list: PlacedFurniture[], catalog: Map<string, CatalogItem>) {
  const collisions = checkFurniture(room, list, catalog)
  const clearance = clearanceIssues(room, list, catalog)
  return list.flatMap((f, i) => {
    const item = catalog.get(f.catalogId)
    if (!item) return []
    const dims = furnitureDims(f, item)
    const colors = furnitureColors(f, item)
    const roles = item.procedural ? (Object.keys(colors) as Role[]).filter((r) => ['main', 'wood', 'metal', 'accent'].includes(r)) : f.colors?.main ? (['main'] as Role[]) : []
    const deg = Math.round(((((f.rotationY * 180) / Math.PI) % 360) + 360) % 360)
    return [
      {
        tag: `F${i + 1}`,
        f,
        item,
        dims,
        deg,
        colors: roles.map((r) => ({ label: item.procedural ? roleLabel(item.procedural.kind, r) : '色調', hex: colors[r] })),
        distances: wallDistances(room, f, item).slice(0, 2),
        corners: obbCorners(furnitureOBB(f, item, 0)),
        problems: [...(collisions.get(f.id)?.ok === false ? collisions.get(f.id)!.reasons : []), ...(clearance.get(f.id) ?? [])],
      },
    ]
  })
}

export function outerPolygon(floor: Vec2[], t: number) {
  const n = floor.length
  const sign = signedArea(floor) < 0 ? -1 : 1
  const lines = floor.map((_, i) => {
    const s = wallSegment(floor, i)
    const o = { x: -s.normal.x * sign * t, z: -s.normal.z * sign * t }
    return { p: { x: s.a.x + o.x, z: s.a.z + o.z }, d: s.dir }
  })
  return floor.map((v, i) => {
    const l1 = lines[(i - 1 + n) % n]
    const l2 = lines[i]
    const c = l1.d.x * l2.d.z - l1.d.z * l2.d.x
    if (Math.abs(c) < 1e-6) return l2.p
    const k = ((l2.p.x - l1.p.x) * l2.d.z - (l2.p.z - l1.p.z) * l2.d.x) / c
    return { x: l1.p.x + l1.d.x * k, z: l1.p.z + l1.d.z * k }
  })
}

export function roomSummary(room: Room) {
  const area = Math.abs(signedArea(room.floor))
  const b = bbox(room.floor)
  const angles = room.floor.map((_, i) => cornerAngle(room.floor, i))
  return { area, ping: area / PING, perimeter: room.floor.reduce((s, _, i) => s + wallSegment(room.floor, i).length, 0), bbox: b, angles }
}

export function swingText(it: WallItem) {
  if (it.type !== 'door') return ''
  const s = it.swing
  const hinge = (s?.hinge ?? 'start') === 'start' ? '左' : '右'
  const side = (s?.side ?? 'in') === 'in' ? '內開' : '外開'
  return `${hinge}鉸${side} ${s?.angle ?? 90}°`
}

export function itemLabel(it: WallItem) {
  return itemTypeInfo(it.type).label
}

export { doorSwingGeometry }
