import type { CatalogItem, PlacedFurniture, Room, Vec2 } from '@/types/room'
import { furnitureDims } from './catalog'
import { bbox, pointInPolygon, wallPoint, wallSegment } from './geometry'
import { convexOverlap, doorZones, furnitureOBB, obbCorners, obbInsideRoom, obbOverlap, resolveAll, type OBB } from './collision'
import { facingAngle, roomCentroid } from './layout'

export type LayoutPrefs = {
  bedWindow: 'any' | 'near' | 'away'
  bedCorner: boolean
  deskWindow: boolean
  sofaFaceTv: boolean
  wheelchair: boolean
  spacious: boolean
}

export const DEFAULT_PREFS: LayoutPrefs = {
  bedWindow: 'any',
  bedCorner: false,
  deskWindow: false,
  sofaFaceTv: false,
  wheelchair: false,
  spacious: false,
}

export const WEIGHTS = {
  wallBack: 12,
  wallBackLight: 4,
  bedHeadUnderWindow: -9,
  bedNearWindow: 14,
  bedAwayWindow: 10,
  bedCorner: 12,
  deskNearWindow: 5,
  deskNearWindowPref: 16,
  blockWindow: -6,
  blockSwitch: -5,
  blockOutlet: -1.5,
  underAirConditioner: -4,
  mainPathBlocked: -10,
  bedSideCramped: -6,
  frontCramped: -6,
  diningChairBack: -4,
  sofaCoffeeGap: -20,
  sofaCoffeeAligned: 10,
  sofaFacingTv: 8,
  sofaFacingTvPref: 22,
  tvDistance: -1.5,
  tvOffset: -5,
  pairDistance: -6,
  centerPull: -1.2,
  spaciousCenter: -6,
  spaciousWall: 6,
  cornerItem: 4,
  wastedGap: -3,
  chairAtTable: 9,
  noTurningCircle: -40,
  failed: -60,
}

const MAIN_PATH = 0.9
const WHEELCHAIR_PATH = 1.2
const TURNING = 1.5
const RUNS = 12
const JITTER = 0.8
const WALL_STEP = 0.1
const GRID_STEP = 0.2

type Role =
  | 'bed'
  | 'sofa'
  | 'wardrobe'
  | 'bookshelf'
  | 'tvstand'
  | 'cabinet'
  | 'desk'
  | 'dining'
  | 'coffee'
  | 'chair'
  | 'nightstand'
  | 'side'
  | 'rug'
  | 'lamp'
  | 'plant'
  | 'decor'
  | 'appliance'
  | 'bath'
  | 'accent'

const WALL_ROLES = new Set<Role>(['bed', 'sofa', 'wardrobe', 'bookshelf', 'tvstand', 'cabinet', 'desk', 'nightstand', 'appliance', 'bath'])
const CORNER_ROLES = new Set<Role>(['lamp', 'plant'])
const FREE_CATEGORIES = new Set(['地毯', '裝飾'])
const TIER: Record<Role, number> = {
  bed: 0,
  wardrobe: 0,
  sofa: 0,
  dining: 0,
  desk: 0,
  bath: 0,
  appliance: 0,
  bookshelf: 1,
  tvstand: 1,
  cabinet: 1,
  coffee: 2,
  nightstand: 2,
  chair: 2,
  side: 3,
  accent: 3,
  lamp: 4,
  plant: 4,
  decor: 4,
  rug: 5,
}

export function roleOf(item: CatalogItem): Role {
  const key = `${item.procedural?.kind ?? ''} ${item.id} ${item.name}`.toLowerCase()
  const has = (...w: string[]) => w.some((x) => key.includes(x))
  switch (item.category) {
    case '床':
      return 'bed'
    case '沙發':
      if (has('ottoman', 'pouf', '腳凳', '坐墩')) return 'side'
      if (has('beanbag', '懶骨頭', 'lounge', '躺椅')) return 'accent'
      return 'sofa'
    case '桌':
      if (has('coffee', '茶几', 'table_low')) return 'coffee'
      if (has('desk', '書桌', '辦公桌', '電腦桌', 'vanity', '化妝')) return 'desk'
      if (has('side', '邊几', '邊桌', 'table_small', 'bar-table', '吧台', '小圓木桌')) return 'side'
      return 'dining'
    case '椅':
      if (has('ottoman', '腳凳')) return 'side'
      return 'chair'
    case '櫃':
      if (has('wardrobe', '衣櫃', 'clothes-rack', '吊衣')) return 'wardrobe'
      if (has('tv-stand', '電視櫃')) return 'tvstand'
      if (has('nightstand', '床頭櫃')) return 'nightstand'
      if (has('book', '書', 'shelf', '層架')) return 'bookshelf'
      return 'cabinet'
    case '家電':
      return has('tv-', '電視') ? 'tvstand' : 'appliance'
    case '燈':
      return 'lamp'
    case '植物':
      return 'plant'
    case '地毯':
      return 'rug'
    case '衛浴':
      return 'bath'
    default:
      return 'decor'
  }
}

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const fwd = (r: number) => ({ x: Math.sin(r), z: Math.cos(r) })
const right = (r: number) => ({ x: Math.cos(r), z: -Math.sin(r) })
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z)

type Placed = { f: PlacedFurniture; item: CatalogItem; role: Role; obb: OBB; wall: number | null }
type Cand = { f: PlacedFurniture; wall: number | null; t?: number }

type Ctx = {
  room: Room
  catalog: Map<string, CatalogItem>
  prefs: LayoutPrefs
  doors: Vec2[][]
  corridors: Vec2[][]
  windows: { wall: number; center: Vec2; t0: number; t1: number; elevation: number }[]
  electric: { wall: number; t0: number; t1: number; elevation: number; type: string }[]
  center: Vec2
  centerRadius: number
  baseAngle: number
  grid: Vec2[]
}

function rectPoly(a: Vec2, b: Vec2, width: number): Vec2[] {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const l = Math.hypot(dx, dz) || 1
  const nx = (-dz / l) * (width / 2)
  const nz = (dx / l) * (width / 2)
  return [
    { x: a.x + nx, z: a.z + nz },
    { x: b.x + nx, z: b.z + nz },
    { x: b.x - nx, z: b.z - nz },
    { x: a.x - nx, z: a.z - nz },
  ]
}

function buildCtx(room: Room, catalog: Map<string, CatalogItem>, prefs: LayoutPrefs): Ctx {
  const center = roomCentroid(room)
  const b = bbox(room.floor)
  const path = prefs.wheelchair ? WHEELCHAIR_PATH : MAIN_PATH
  const corridors: Vec2[][] = []
  const windows: Ctx['windows'] = []
  const electric: Ctx['electric'] = []
  room.walls.forEach((w, i) => {
    for (const it of w.items) {
      const t0 = it.offset
      const t1 = it.offset + it.width
      if (it.type === 'door') {
        const mid = wallPoint(room.floor, i, (t0 + t1) / 2, 0.3)
        const len = dist(mid, center)
        const k = Math.max(0.4, len - 1) / (len || 1)
        corridors.push(rectPoly(mid, { x: mid.x + (center.x - mid.x) * k, z: mid.z + (center.z - mid.z) * k }, path))
      } else if (it.type === 'window') {
        windows.push({ wall: i, center: wallPoint(room.floor, i, (t0 + t1) / 2, 0), t0, t1, elevation: it.elevation })
      } else if (it.type === 'switch' || it.type === 'outlet' || it.type === 'air_conditioner') {
        electric.push({ wall: i, t0, t1, elevation: it.elevation, type: it.type })
      }
    }
  })
  let longest = 0
  let baseAngle = 0
  room.floor.forEach((_, i) => {
    const s = wallSegment(room.floor, i)
    if (s.length > longest) {
      longest = s.length
      baseAngle = facingAngle(s.normal.x, s.normal.z)
    }
  })
  const grid: Vec2[] = []
  for (let x = b.minX + GRID_STEP; x < b.maxX; x += GRID_STEP)
    for (let z = b.minZ + GRID_STEP; z < b.maxZ; z += GRID_STEP) if (pointInPolygon({ x, z }, room.floor)) grid.push({ x, z })
  return {
    room,
    catalog,
    prefs,
    doors: doorZones(room),
    corridors,
    windows,
    electric,
    center,
    centerRadius: Math.min(b.width, b.depth) * 0.28,
    baseAngle,
    grid,
  }
}

function wallCandidates(ctx: Ctx, f: PlacedFurniture, item: CatalogItem): Cand[] {
  const { width, depth } = furnitureDims(f, item)
  const out: Cand[] = []
  ctx.room.floor.forEach((_, i) => {
    const s = wallSegment(ctx.room.floor, i)
    if (s.length < width + 0.02) return
    const rot = facingAngle(s.normal.x, s.normal.z)
    for (let t = width / 2 + 0.01; t <= s.length - width / 2 - 0.01 + 1e-9; t += WALL_STEP) {
      const p = wallPoint(ctx.room.floor, i, t, depth / 2 + 0.015)
      out.push({ f: { ...f, position: { x: p.x, y: 0, z: p.z }, rotationY: rot }, wall: i, t })
    }
    const tEnd = s.length - width / 2 - 0.01
    const p = wallPoint(ctx.room.floor, i, tEnd, depth / 2 + 0.015)
    out.push({ f: { ...f, position: { x: p.x, y: 0, z: p.z }, rotationY: rot }, wall: i, t: tEnd })
  })
  return out
}

function gridCandidates(ctx: Ctx, f: PlacedFurniture, rotations: number[]): Cand[] {
  return ctx.grid.flatMap((p) => rotations.map((r) => ({ f: { ...f, position: { x: p.x, y: 0, z: p.z }, rotationY: r }, wall: null })))
}

function at(f: PlacedFurniture, p: Vec2, rot: number): Cand {
  return { f: { ...f, position: { x: p.x, y: 0, z: p.z }, rotationY: rot }, wall: null }
}

function anchorCandidates(ctx: Ctx, f: PlacedFurniture, item: CatalogItem, role: Role, placed: Placed[]): Cand[] {
  const d = furnitureDims(f, item)
  const out: Cand[] = []
  for (const a of placed) {
    const ad = furnitureDims(a.f, a.item)
    const p = a.f.position
    const r = a.f.rotationY
    const F = fwd(r)
    const R = right(r)
    if (role === 'coffee' && a.role === 'sofa') {
      for (const gap of [0.4, 0.42, 0.45]) {
        const k = ad.depth / 2 + gap + d.depth / 2
        out.push(at(f, { x: p.x + F.x * k, z: p.z + F.z * k }, r))
      }
    }
    if (role === 'chair' && a.role === 'desk') {
      const k = ad.depth / 2 + d.depth / 2 + 0.05
      out.push(at(f, { x: p.x + F.x * k, z: p.z + F.z * k }, r + Math.PI))
    }
    if (role === 'chair' && a.role === 'dining') {
      for (const side of [1, -1]) {
        const k = ad.depth / 2 + d.depth / 2 + 0.05
        const n = Math.max(1, Math.floor(ad.width / 0.6))
        for (let j = 0; j < n; j++) {
          const o = (j - (n - 1) / 2) * (ad.width / n)
          out.push(at(f, { x: p.x + F.x * k * side + R.x * o, z: p.z + F.z * k * side + R.z * o }, side === 1 ? r + Math.PI : r))
        }
        const ke = ad.width / 2 + d.depth / 2 + 0.05
        out.push(at(f, { x: p.x + R.x * ke * side, z: p.z + R.z * ke * side }, r + (side === 1 ? -Math.PI / 2 : Math.PI / 2)))
      }
    }
    if (role === 'nightstand' && a.role === 'bed') {
      for (const side of [1, -1]) {
        const kx = ad.width / 2 + d.width / 2 + 0.03
        const kz = -ad.depth / 2 + d.depth / 2 + 0.02
        out.push(at(f, { x: p.x + R.x * kx * side + F.x * kz, z: p.z + R.z * kx * side + F.z * kz }, r))
      }
    }
    if (role === 'side' && (a.role === 'sofa' || a.role === 'bed')) {
      for (const side of [1, -1]) {
        const kx = ad.width / 2 + d.width / 2 + 0.05
        const kz = -ad.depth / 2 + d.depth / 2 + 0.05
        out.push(at(f, { x: p.x + R.x * kx * side + F.x * kz, z: p.z + R.z * kx * side + F.z * kz }, r))
      }
    }
    if (role === 'rug') {
      if (a.role === 'coffee' || a.role === 'dining') out.push(at(f, p, r))
      if (a.role === 'bed') out.push(at(f, { x: p.x + F.x * ad.depth * 0.25, z: p.z + F.z * ad.depth * 0.25 }, r + Math.PI / 2))
      if (a.role === 'sofa') {
        const k = ad.depth / 2 + d.depth / 2 - 0.15
        out.push(at(f, { x: p.x + F.x * k, z: p.z + F.z * k }, r))
      }
    }
  }
  if (role === 'rug') out.push(at(f, ctx.center, ctx.baseAngle), at(f, ctx.center, ctx.baseAngle + Math.PI / 2))
  return out
}

function candidatesFor(ctx: Ctx, f: PlacedFurniture, item: CatalogItem, role: Role, placed: Placed[]): Cand[] {
  const a = ctx.baseAngle
  const four = [a, a + Math.PI / 2, a + Math.PI, a - Math.PI / 2]
  if (WALL_ROLES.has(role)) return [...wallCandidates(ctx, f, item), ...(role === 'nightstand' ? anchorCandidates(ctx, f, item, role, placed) : [])]
  if (CORNER_ROLES.has(role)) return [...wallCandidates(ctx, f, item), ...gridCandidates(ctx, f, [a])]
  if (role === 'rug') return anchorCandidates(ctx, f, item, role, placed)
  if (role === 'coffee' || role === 'chair' || role === 'side') return [...anchorCandidates(ctx, f, item, role, placed), ...gridCandidates(ctx, f, role === 'chair' ? four : [a, a + Math.PI / 2])]
  if (role === 'dining') return gridCandidates(ctx, f, [a, a + Math.PI / 2])
  return [...gridCandidates(ctx, f, four), ...wallCandidates(ctx, f, item)]
}

function feasible(ctx: Ctx, obb: OBB, item: CatalogItem, placed: Placed[]) {
  if (!obbInsideRoom(obb, ctx.room.floor)) return false
  if (FREE_CATEGORIES.has(item.category)) return true
  const corners = obbCorners(obb)
  if (ctx.doors.some((d) => convexOverlap(corners, d))) return false
  return !placed.some((p) => !FREE_CATEGORIES.has(p.item.category) && obbOverlap(obb, p.obb))
}

function zoneFront(f: PlacedFurniture, d: { width: number; depth: number }, depth: number): OBB {
  const F = fwd(f.rotationY)
  const off = d.depth / 2 + depth / 2
  return { cx: f.position.x + F.x * off, cz: f.position.z + F.z * off, hw: d.width / 2 - 0.02, hd: depth / 2 - 0.01, angle: f.rotationY }
}

function zoneBack(f: PlacedFurniture, d: { width: number; depth: number }, depth: number): OBB {
  const F = fwd(f.rotationY)
  const off = d.depth / 2 + depth / 2
  return { cx: f.position.x - F.x * off, cz: f.position.z - F.z * off, hw: d.width / 2 - 0.02, hd: depth / 2 - 0.01, angle: f.rotationY }
}

function zoneSide(f: PlacedFurniture, d: { width: number; depth: number }, width: number, side: 1 | -1): OBB {
  const R = right(f.rotationY)
  const off = d.width / 2 + width / 2
  return { cx: f.position.x + R.x * off * side, cz: f.position.z + R.z * off * side, hw: width / 2 - 0.01, hd: d.depth * 0.35, angle: f.rotationY }
}

function freeZone(ctx: Ctx, zone: OBB, others: Placed[]) {
  return obbInsideRoom(zone, ctx.room.floor) && !others.some((o) => !FREE_CATEGORIES.has(o.item.category) && obbOverlap(zone, o.obb))
}

function reservedZones(o: Placed): { zones: OBB[]; anyOf: boolean }[] {
  const d = furnitureDims(o.f, o.item)
  switch (o.role) {
    case 'bed':
      return [{ zones: [zoneSide(o.f, d, 0.6, 1), zoneSide(o.f, d, 0.6, -1)], anyOf: true }]
    case 'wardrobe':
      return [{ zones: [zoneFront(o.f, d, 0.9)], anyOf: false }]
    case 'desk':
      return [{ zones: [zoneFront(o.f, d, 0.75)], anyOf: false }]
    case 'cabinet':
    case 'appliance':
    case 'bookshelf':
      return [{ zones: [zoneFront(o.f, d, 0.6)], anyOf: false }]
    case 'sofa':
      return [{ zones: [zoneFront(o.f, d, 0.35)], anyOf: false }]
    default:
      return []
  }
}

function intrusion(ctx: Ctx, obb: OBB, role: Role, placed: Placed[]) {
  let penalty = 0
  for (const o of placed) {
    for (const group of reservedZones(o)) {
      const hits = group.zones.map((z) => obbOverlap(obb, z))
      if (!hits.some(Boolean)) continue
      if (role === 'chair' && o.role === 'desk') continue
      if ((role === 'coffee' || role === 'side') && o.role === 'sofa') continue
      if ((role === 'nightstand' || role === 'side') && o.role === 'bed') continue
      if (group.anyOf) {
        const stillFree = group.zones.some((z, i) => !hits[i] && freeZone(ctx, z, placed.filter((p) => p !== o)))
        if (!stillFree) penalty += WEIGHTS.bedSideCramped
      } else penalty += WEIGHTS.frontCramped
    }
  }
  return penalty
}

function windowCloseness(ctx: Ctx, p: Vec2, range: number) {
  let best = 0
  for (const w of ctx.windows) best = Math.max(best, 1 - Math.min(dist(p, w.center), range) / range)
  return best
}

function score(ctx: Ctx, cand: Cand, item: CatalogItem, role: Role, obb: OBB, placed: Placed[]) {
  const W = WEIGHTS
  const prefs = ctx.prefs
  const f = cand.f
  const d = furnitureDims(f, item)
  const p = f.position
  const corners = obbCorners(obb)
  const blocking = !FREE_CATEGORIES.has(item.category)
  let s = 0

  if (cand.wall !== null && cand.t !== undefined) {
    if (WALL_ROLES.has(role)) s += W.wallBack
    else if (role !== 'rug') s += W.wallBackLight
    if (prefs.spacious && blocking) s += W.spaciousWall
    const t0 = cand.t - d.width / 2
    const t1 = cand.t + d.width / 2
    const overlaps = (a0: number, a1: number) => a0 < t1 - 0.02 && a1 > t0 + 0.02
    const wallLen = wallSegment(ctx.room.floor, cand.wall).length
    for (const gap of [t0, wallLen - t1]) if (gap > 0.05 && gap < 0.45) s += W.wastedGap
    for (const w of ctx.windows) {
      if (w.wall !== cand.wall || !overlaps(w.t0, w.t1)) continue
      if (role === 'bed') s += W.bedHeadUnderWindow
      else if (d.height > w.elevation + 0.1) s += W.blockWindow
    }
    for (const e of ctx.electric) {
      if (e.wall !== cand.wall || !overlaps(e.t0, e.t1)) continue
      if (e.type === 'switch' && d.height > e.elevation - 0.15) s += W.blockSwitch
      if (e.type === 'outlet' && d.height > e.elevation) s += W.blockOutlet
      if (e.type === 'air_conditioner' && d.height > 1.5) s += W.underAirConditioner
    }
    if (CORNER_ROLES.has(role) || (role === 'bed' && prefs.bedCorner)) {
      const len = wallSegment(ctx.room.floor, cand.wall).length
      const inCorner = t0 < 0.06 || len - t1 < 0.06
      if (inCorner) s += role === 'bed' ? W.bedCorner : W.cornerItem
    }
  }

  if (blocking && role !== 'rug' && ctx.corridors.some((c) => convexOverlap(corners, c))) s += W.mainPathBlocked
  if (blocking) s += intrusion(ctx, obb, role, placed)

  if (prefs.spacious && blocking && cand.wall === null && !['coffee', 'dining', 'chair', 'side'].includes(role)) {
    if (dist(p, ctx.center) < ctx.centerRadius) s += W.spaciousCenter
  }

  if (role === 'bed') {
    const near = windowCloseness(ctx, p, 3)
    if (prefs.bedWindow === 'near') s += W.bedNearWindow * near
    if (prefs.bedWindow === 'away') s += W.bedAwayWindow * (1 - near)
    const l = freeZone(ctx, zoneSide(f, d, 0.6, 1), placed)
    const r = freeZone(ctx, zoneSide(f, d, 0.6, -1), placed)
    if (!l && !r) s += W.bedSideCramped
    if (!freeZone(ctx, zoneFront(f, d, 0.5), placed)) s += W.frontCramped * 0.5
  }
  if (role === 'desk') s += (prefs.deskWindow ? W.deskNearWindowPref : W.deskNearWindow) * windowCloseness(ctx, p, 2.5)
  if (role === 'wardrobe' && !freeZone(ctx, zoneFront(f, d, 0.9), placed)) s += W.frontCramped
  if ((role === 'cabinet' || role === 'appliance' || role === 'bookshelf') && !freeZone(ctx, zoneFront(f, d, 0.7), placed)) s += W.frontCramped * 0.6
  if (role === 'desk' && !freeZone(ctx, zoneFront(f, d, 0.75), placed)) s += W.frontCramped
  if (role === 'chair') {
    const table = placed.find((o) => o.role === 'dining' && dist(o.f.position, p) < 1.6)
    if (table && !freeZone(ctx, zoneBack(f, d, 0.75), placed)) s += W.diningChairBack
  }

  for (const o of placed) {
    const od = furnitureDims(o.f, o.item)
    if ((role === 'coffee' && o.role === 'sofa') || (role === 'sofa' && o.role === 'coffee')) {
      const sofa = role === 'sofa' ? f : o.f
      const sd = role === 'sofa' ? d : od
      const coffee = role === 'sofa' ? o.f : f
      const cdp = role === 'sofa' ? od : d
      const F = fwd(sofa.rotationY)
      const vx = coffee.position.x - sofa.position.x
      const vz = coffee.position.z - sofa.position.z
      const along = vx * F.x + vz * F.z
      const lateral = Math.abs(vx * F.z - vz * F.x)
      const gap = along - sd.depth / 2 - cdp.depth / 2
      if (along > 0 && lateral < 0.5 && gap > -0.05 && gap < 1.2) s += W.sofaCoffeeAligned + W.sofaCoffeeGap * Math.abs(gap - 0.425)
    }
    if ((role === 'tvstand' && o.role === 'sofa') || (role === 'sofa' && o.role === 'tvstand')) {
      const sofa = role === 'sofa' ? f : o.f
      const tv = role === 'sofa' ? o.f : f
      const vx = tv.position.x - sofa.position.x
      const vz = tv.position.z - sofa.position.z
      const l = Math.hypot(vx, vz) || 1
      const Fs = fwd(sofa.rotationY)
      const Ft = fwd(tv.rotationY)
      const facing = (Fs.x * vx + Fs.z * vz) / l > 0.85 && -(Ft.x * vx + Ft.z * vz) / l > 0.85
      const offset = Math.abs(vx * Fs.z - vz * Fs.x)
      if (facing) s += (prefs.sofaFaceTv ? W.sofaFacingTvPref : W.sofaFacingTv) + W.tvDistance * Math.abs(l - 2.6) + W.tvOffset * offset
    }
    if ((role === 'nightstand' && o.role === 'bed') || (role === 'side' && (o.role === 'sofa' || o.role === 'bed'))) {
      s += W.pairDistance * Math.max(0, dist(p, o.f.position) - (od.width / 2 + d.width / 2 + 0.2))
    }
    if (role === 'chair' && (o.role === 'desk' || o.role === 'dining')) {
      const near = dist(p, o.f.position)
      s += W.pairDistance * Math.max(0, near - (od.depth / 2 + d.depth + 0.3)) * 0.6
      const F = fwd(o.f.rotationY)
      const vx = p.x - o.f.position.x
      const vz = p.z - o.f.position.z
      const along = vx * F.x + vz * F.z
      const lateral = vx * F.z - vz * F.x
      const Fc = fwd(f.rotationY)
      const facing = (Fc.x * -vx + Fc.z * -vz) / (Math.hypot(vx, vz) || 1)
      const front = o.role === 'dining' ? Math.abs(along) : along
      const sideways = o.role === 'dining' && Math.abs(lateral) > od.width / 2 && Math.abs(along) < od.depth / 2
      const inFront = front > od.depth / 2 && front < od.depth / 2 + d.depth + 0.25 && Math.abs(lateral) < od.width / 2
      if ((inFront || sideways) && facing > 0.7) s += W.chairAtTable
    }
  }

  if (role === 'dining' || role === 'coffee' || role === 'accent') s += W.centerPull * dist(p, ctx.center)
  return s
}

function hasTurningCircle(ctx: Ctx, placed: Placed[]) {
  const half = TURNING / 2
  for (const g of ctx.grid) {
    const zone: OBB = { cx: g.x, cz: g.z, hw: half, hd: half, angle: ctx.baseAngle }
    if (freeZone(ctx, zone, placed)) return true
  }
  return false
}

function runOnce(ctx: Ctx, items: { f: PlacedFurniture; item: CatalogItem; role: Role }[], jitter: () => number) {
  const placed: Placed[] = []
  const failed: string[] = []
  let total = 0
  for (const it of items) {
    let best: { cand: Cand; obb: OBB; s: number; j: number } | null = null
    for (const cand of candidatesFor(ctx, it.f, it.item, it.role, placed)) {
      const obb = furnitureOBB(cand.f, it.item)
      if (!feasible(ctx, obb, it.item, placed)) continue
      const s = score(ctx, cand, it.item, it.role, obb, placed)
      const j = s + jitter()
      if (!best || j > best.j + 1e-9) best = { cand, obb, s, j }
    }
    if (best) {
      placed.push({ f: best.cand.f, item: it.item, role: it.role, obb: best.obb, wall: best.cand.wall })
      total += best.s
    } else {
      failed.push(it.f.id)
      total += WEIGHTS.failed
    }
  }
  if (ctx.prefs.wheelchair && !hasTurningCircle(ctx, placed)) total += WEIGHTS.noTurningCircle
  return { placed, failed, total }
}

export type LayoutOutcome = { list: PlacedFurniture[]; failed: string[]; unmet: string[]; met: string[] }

export function autoLayout(room: Room, list: PlacedFurniture[], catalog: Map<string, CatalogItem>, prefs: LayoutPrefs): LayoutOutcome {
  const ctx = buildCtx(room, catalog, prefs)
  const items = list.flatMap((f) => {
    const item = catalog.get(f.catalogId)
    return item ? [{ f, item, role: roleOf(item) }] : []
  })
  const area = (x: (typeof items)[number]) => {
    const d = furnitureDims(x.f, x.item)
    return d.width * d.depth
  }
  const tier = (r: Role) => (prefs.deskWindow && r === 'desk' ? -1 : TIER[r])
  const base = [...items].sort((a, b) => tier(a.role) - tier(b.role) || area(b) - area(a) || a.f.id.localeCompare(b.f.id))
  let best: ReturnType<typeof runOnce> | null = null
  for (let run = 0; run < RUNS; run++) {
    const rand = rng(20261108 + run * 7919)
    const order = run === 0 ? base : [...base].sort((a, b) => tier(a.role) - tier(b.role) || Math.round(area(b) * 4) - Math.round(area(a) * 4) || rand() - 0.5)
    const r = runOnce(ctx, order, run === 0 ? () => 0 : () => rand() * JITTER)
    if (!best || r.total > best.total) best = r
  }
  const placedMap = new Map(best!.placed.map((p) => [p.f.id, p.f]))
  const proposed = list.map((f) => placedMap.get(f.id) ?? f)
  const resolved = resolveAll(room, proposed, catalog)
  const report = evaluate(ctx, best!.placed)
  return { list: resolved.list, failed: Array.from(new Set([...best!.failed, ...resolved.failed])), ...report }
}

function evaluate(ctx: Ctx, placed: Placed[]) {
  const met: string[] = []
  const unmet: string[] = []
  const prefs = ctx.prefs
  const beds = placed.filter((p) => p.role === 'bed')
  const desks = placed.filter((p) => p.role === 'desk')
  const sofas = placed.filter((p) => p.role === 'sofa')
  const tvs = placed.filter((p) => p.role === 'tvstand')
  const nearWindow = (p: Placed, r: number) => ctx.windows.some((w) => dist(p.f.position, w.center) <= r)
  const check = (on: boolean, label: string, ok: boolean, why: string) => {
    if (!on) return
    if (ok) met.push(label)
    else unmet.push(`${label}（${why}）`)
  }
  check(prefs.bedWindow === 'near', '床靠窗', beds.some((b) => nearWindow(b, 1.8)), ctx.windows.length ? '窗邊空間不夠' : '還沒有標記窗戶')
  check(prefs.bedWindow === 'away', '床不靠窗', beds.length > 0 && beds.every((b) => !nearWindow(b, 1.2)), '房間太小')
  check(prefs.bedCorner, '床靠牆角', beds.some((b) => b.wall !== null && cornerTouch(ctx, b)), beds.length ? '牆角被門或其他家具占用' : '房間裡沒有床')
  check(prefs.deskWindow, '書桌靠窗', desks.some((d) => nearWindow(d, 1.5)), !desks.length ? '房間裡沒有書桌' : ctx.windows.length ? '窗邊空間不夠' : '還沒有標記窗戶')
  check(
    prefs.sofaFaceTv,
    '沙發面向電視櫃',
    sofas.some((s) => tvs.some((t) => facingEach(s.f, t.f))),
    !sofas.length || !tvs.length ? '需要同時有沙發和電視櫃' : '找不到可以對望的兩面牆',
  )
  check(prefs.wheelchair, '輪椅動線', hasTurningCircle(ctx, placed), '找不到直徑 1.5 公尺的迴轉空間，建議減少家具')
  check(prefs.spacious, '空間寬敞', !placed.some((p) => !FREE_CATEGORIES.has(p.item.category) && p.wall === null && !['coffee', 'dining', 'chair', 'side'].includes(p.role) && dist(p.f.position, ctx.center) < ctx.centerRadius), '家具太多，中央無法完全留空')
  return { met, unmet }
}

function cornerTouch(ctx: Ctx, p: Placed) {
  if (p.wall === null) return false
  const s = wallSegment(ctx.room.floor, p.wall)
  const d = furnitureDims(p.f, p.item)
  const t = (p.f.position.x - s.a.x) * s.dir.x + (p.f.position.z - s.a.z) * s.dir.z
  return t - d.width / 2 < 0.08 || s.length - (t + d.width / 2) < 0.08
}

function facingEach(a: PlacedFurniture, b: PlacedFurniture) {
  const vx = b.position.x - a.position.x
  const vz = b.position.z - a.position.z
  const l = Math.hypot(vx, vz) || 1
  const Fa = fwd(a.rotationY)
  const Fb = fwd(b.rotationY)
  return (Fa.x * vx + Fa.z * vz) / l > 0.8 && -(Fb.x * vx + Fb.z * vz) / l > 0.8
}

export const PREF_OPTIONS: { key: keyof LayoutPrefs; value: LayoutPrefs[keyof LayoutPrefs]; label: string; hint: string }[] = [
  { key: 'bedWindow', value: 'near', label: '床靠窗', hint: '床放在窗戶旁邊（床頭不會正對窗下）' },
  { key: 'bedWindow', value: 'away', label: '床不要靠窗', hint: '床離窗戶遠一點，避免西曬與冷風' },
  { key: 'bedCorner', value: true, label: '床靠牆角', hint: '床的一側貼著牆角，省出地板空間' },
  { key: 'deskWindow', value: true, label: '書桌靠窗', hint: '書桌放在窗邊，採光比較好' },
  { key: 'sofaFaceTv', value: true, label: '沙發面向電視櫃', hint: '沙發與電視櫃面對面，距離約 2.6 公尺' },
  { key: 'wheelchair', value: true, label: '留輪椅動線', hint: '主要走道 120 公分，並保留直徑 150 公分的迴轉空間' },
  { key: 'spacious', value: true, label: '讓空間看起來寬敞', hint: '家具盡量靠牆，房間中央留空' },
]

export function prefActive(prefs: LayoutPrefs, opt: (typeof PREF_OPTIONS)[number]) {
  return prefs[opt.key] === opt.value
}

export function togglePref(prefs: LayoutPrefs, opt: (typeof PREF_OPTIONS)[number]): LayoutPrefs {
  const on = prefActive(prefs, opt)
  const off = DEFAULT_PREFS[opt.key]
  return { ...prefs, [opt.key]: on ? off : opt.value }
}

const KEYWORDS: { match: (t: string) => boolean; label: string; apply: (p: LayoutPrefs, on: boolean) => LayoutPrefs }[] = [
  {
    match: (t) => /床/.test(t) && /(不要|別|不想|遠離|離).{0,4}窗|窗.{0,4}(遠|不要)/.test(t),
    label: '床不要靠窗',
    apply: (p, on) => ({ ...p, bedWindow: on ? 'away' : 'any' }),
  },
  { match: (t) => /床/.test(t) && /窗/.test(t), label: '床靠窗', apply: (p, on) => ({ ...p, bedWindow: on ? 'near' : 'any' }) },
  { match: (t) => /床/.test(t) && /(牆角|角落|靠角)/.test(t), label: '床靠牆角', apply: (p, on) => ({ ...p, bedCorner: on }) },
  { match: (t) => /(書桌|桌子|工作桌|電腦桌)/.test(t) && /窗/.test(t), label: '書桌靠窗', apply: (p, on) => ({ ...p, deskWindow: on }) },
  { match: (t) => /沙發/.test(t) && /電視/.test(t), label: '沙發面向電視櫃', apply: (p, on) => ({ ...p, sofaFaceTv: on }) },
  { match: (t) => /(輪椅|無障礙|行動不便|拐杖|助行)/.test(t), label: '留輪椅動線', apply: (p, on) => ({ ...p, wheelchair: on }) },
  { match: (t) => /(寬敞|開闊|空間大|不要擠|留空|大一點)/.test(t), label: '讓空間看起來寬敞', apply: (p, on) => ({ ...p, spacious: on }) },
]

export function parseRequest(text: string, prefs: LayoutPrefs) {
  const t = text.replace(/\s+/g, '')
  const off = /(取消|關掉|不用|算了|移除)/.test(t)
  let next = prefs
  const matched: string[] = []
  for (const k of KEYWORDS) {
    if (!k.match(t)) continue
    if (matched.includes('床不要靠窗') && k.label === '床靠窗') continue
    next = k.apply(next, !off)
    matched.push(k.label)
  }
  return { prefs: next, matched, turnedOff: off }
}
