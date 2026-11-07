import type { Vec2, Wall, WallItem } from '@/types/room'

export const MIN_WALL = 0.5
export const MIN_HEIGHT = 2
export const MAX_HEIGHT = 5

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

export function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function rectFloor(width: number, depth: number): Vec2[] {
  const w = width / 2
  const d = depth / 2
  return [
    { x: -w, z: -d },
    { x: w, z: -d },
    { x: w, z: d },
    { x: -w, z: d },
  ]
}

export function signedArea(poly: Vec2[]) {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p.x * q.z - q.x * p.z
  }
  return a / 2
}

export function ensureCCW(poly: Vec2[]) {
  return signedArea(poly) < 0 ? [...poly].reverse() : poly
}

export function wallSegment(floor: Vec2[], i: number) {
  const a = floor[i]
  const b = floor[(i + 1) % floor.length]
  const dx = b.x - a.x
  const dz = b.z - a.z
  const length = Math.hypot(dx, dz)
  const dir = { x: dx / (length || 1), z: dz / (length || 1) }
  const normal = { x: -dir.z, z: dir.x }
  const angle = Math.atan2(-dz, dx)
  return { a, b, length, dir, normal, angle }
}

export function wallLengths(floor: Vec2[]) {
  return floor.map((_, i) => wallSegment(floor, i).length)
}

export function bbox(poly: Vec2[]) {
  const xs = poly.map((p) => p.x)
  const zs = poly.map((p) => p.z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  return { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 }
}

export function isRectangle(poly: Vec2[]) {
  if (poly.length !== 4) return false
  for (let i = 0; i < 4; i++) {
    const s = wallSegment(poly, i)
    if (Math.abs(s.dir.x) > 1e-6 && Math.abs(s.dir.z) > 1e-6) return false
  }
  return true
}

function orient(a: Vec2, b: Vec2, c: Vec2) {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
}

function onSeg(a: Vec2, b: Vec2, c: Vec2) {
  return (
    Math.min(a.x, b.x) - 1e-9 <= c.x &&
    c.x <= Math.max(a.x, b.x) + 1e-9 &&
    Math.min(a.z, b.z) - 1e-9 <= c.z &&
    c.z <= Math.max(a.z, b.z) + 1e-9
  )
}

export function segmentsIntersect(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2) {
  const d1 = orient(p3, p4, p1)
  const d2 = orient(p3, p4, p2)
  const d3 = orient(p1, p2, p3)
  const d4 = orient(p1, p2, p4)
  if (((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9))) return true
  if (Math.abs(d1) <= 1e-9 && onSeg(p3, p4, p1)) return true
  if (Math.abs(d2) <= 1e-9 && onSeg(p3, p4, p2)) return true
  if (Math.abs(d3) <= 1e-9 && onSeg(p1, p2, p3)) return true
  if (Math.abs(d4) <= 1e-9 && onSeg(p1, p2, p4)) return true
  return false
}

export function isSelfIntersecting(poly: Vec2[]) {
  const n = poly.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue
      if (segmentsIntersect(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return true
    }
  }
  return false
}

export function validateFloor(poly: Vec2[]): string[] {
  const errors: string[] = []
  if (poly.length < 3) errors.push('至少需要 3 個頂點')
  const lens = wallLengths(poly)
  lens.forEach((l, i) => {
    if (l < MIN_WALL - 1e-6) errors.push(`第 ${i + 1} 面牆長度 ${l.toFixed(2)}m，需大於 ${MIN_WALL}m`)
  })
  if (isSelfIntersecting(poly)) errors.push('格局不可自我交叉')
  if (Math.abs(signedArea(poly)) < 0.25) errors.push('房間面積太小')
  return errors
}

export function validateHeight(h: number): string | null {
  if (!Number.isFinite(h)) return '請輸入數字'
  if (h < MIN_HEIGHT || h > MAX_HEIGHT) return `高度需介於 ${MIN_HEIGHT}～${MAX_HEIGHT}m`
  return null
}

export function pointInPolygon(p: Vec2, poly: Vec2[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

export function isConvexVertex(poly: Vec2[], i: number) {
  const n = poly.length
  const prev = poly[(i - 1 + n) % n]
  const cur = poly[i]
  const next = poly[(i + 1) % n]
  return orient(prev, cur, next) > 0
}

export function wallPoint(floor: Vec2[], wallIndex: number, offset: number, inset = 0): Vec2 {
  const s = wallSegment(floor, wallIndex)
  return {
    x: s.a.x + s.dir.x * offset + s.normal.x * inset,
    z: s.a.z + s.dir.z * offset + s.normal.z * inset,
  }
}

export function clampItem(item: WallItem, wallLength: number, roomHeight: number): WallItem {
  const width = Math.min(Math.max(item.width, 0.02), wallLength)
  const height = Math.min(Math.max(item.height, 0.02), roomHeight)
  const offset = Math.min(Math.max(item.offset, 0), wallLength - width)
  const elevation = Math.min(Math.max(item.elevation, 0), roomHeight - height)
  return { ...item, width, height, offset, elevation }
}

export function syncWalls(floor: Vec2[], walls: Wall[]): Wall[] {
  return floor.map((_, i) => {
    const w = walls[i]
    if (w) return { ...w, index: i }
    return { id: uid('wall'), index: i, items: [], confirmed: false }
  })
}

export function splitWall(floor: Vec2[], walls: Wall[], wallIndex: number, t: number) {
  const s = wallSegment(floor, wallIndex)
  const mid = { x: round2(s.a.x + (s.b.x - s.a.x) * t), z: round2(s.a.z + (s.b.z - s.a.z) * t) }
  const newFloor = [...floor.slice(0, wallIndex + 1), mid, ...floor.slice(wallIndex + 1)]
  const splitAt = s.length * t
  const original = walls[wallIndex]
  const first: Wall = { ...original, items: original.items.filter((it) => it.offset + it.width / 2 < splitAt), confirmed: false, photoUrl: undefined }
  const second: Wall = {
    id: uid('wall'),
    index: wallIndex + 1,
    items: original.items.filter((it) => it.offset + it.width / 2 >= splitAt).map((it) => ({ ...it, offset: Math.max(0, it.offset - splitAt) })),
    confirmed: false,
  }
  const newWalls = [...walls.slice(0, wallIndex), first, second, ...walls.slice(wallIndex + 1)].map((w, i) => ({ ...w, index: i }))
  return { floor: newFloor, walls: newWalls }
}

export function removeVertex(floor: Vec2[], walls: Wall[], vertexIndex: number) {
  const n = floor.length
  const newFloor = floor.filter((_, i) => i !== vertexIndex)
  const prevWall = (vertexIndex - 1 + n) % n
  const curWall = vertexIndex
  const prevLen = wallSegment(floor, prevWall).length
  const merged: Wall = {
    ...walls[prevWall],
    items: [...walls[prevWall].items, ...walls[curWall].items.map((it) => ({ ...it, offset: it.offset + prevLen }))],
    confirmed: false,
    photoUrl: undefined,
  }
  const list = walls.map((w, i) => (i === prevWall ? merged : w)).filter((_, i) => i !== curWall)
  return { floor: newFloor, walls: list.map((w, i) => ({ ...w, index: i })) }
}

export function scaleFloor(floor: Vec2[], width: number, depth: number) {
  const b = bbox(floor)
  const sx = width / (b.width || 1)
  const sz = depth / (b.depth || 1)
  return floor.map((p) => ({ x: round2((p.x - b.cx) * sx), z: round2((p.z - b.cz) * sz) }))
}

export function scaleWalls(oldFloor: Vec2[], newFloor: Vec2[], walls: Wall[], oldHeight: number, newHeight: number) {
  return walls.map((w, i) => {
    const oldLen = wallSegment(oldFloor, i).length || 1
    const newLen = wallSegment(newFloor, i).length
    const k = newLen / oldLen
    const kh = newHeight / (oldHeight || 1)
    return {
      ...w,
      items: w.items.map((it) =>
        clampItem({ ...it, offset: it.offset * k, width: it.width * k, elevation: it.elevation * kh, height: it.height * kh }, newLen, newHeight),
      ),
    }
  })
}
