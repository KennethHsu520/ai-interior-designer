import type { CatalogItem, PlacedFurniture, Room, Vec2, WallItem } from '@/types/room'
import { doorSwingGeometry, signedArea, wallPoint, wallSegment } from './geometry'
import { cm, furnitureSchedule, outerPolygon, tagWallItems, WALL_T } from './planData'

const LAYERS: [string, number][] = [
  ['A-WALL', 7],
  ['A-DOOR', 30],
  ['A-GLAZ', 5],
  ['A-FURN', 8],
  ['A-DIMS', 1],
  ['A-ANNO', 3],
  ['E-POWR', 6],
]

function enc(s: string) {
  return [...s].map((ch) => (ch.charCodeAt(0) > 126 ? `\\U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}` : ch)).join('')
}

class Writer {
  out: string[] = []
  pair(code: number, v: string | number) {
    this.out.push(String(code), typeof v === 'number' ? (Math.round(v * 1000) / 1000).toString() : v)
  }
  line(layer: string, a: Vec2, b: Vec2) {
    this.pair(0, 'LINE')
    this.pair(8, layer)
    this.pair(10, X(a))
    this.pair(20, Y(a))
    this.pair(30, 0)
    this.pair(11, X(b))
    this.pair(21, Y(b))
    this.pair(31, 0)
  }
  poly(layer: string, ps: Vec2[], closed = true) {
    for (let i = 0; i < ps.length - (closed ? 0 : 1); i++) this.line(layer, ps[i], ps[(i + 1) % ps.length])
  }
  circle(layer: string, c: Vec2, r: number) {
    this.pair(0, 'CIRCLE')
    this.pair(8, layer)
    this.pair(10, X(c))
    this.pair(20, Y(c))
    this.pair(30, 0)
    this.pair(40, r * 1000)
  }
  arc(layer: string, c: Vec2, r: number, a0: number, a1: number) {
    this.pair(0, 'ARC')
    this.pair(8, layer)
    this.pair(10, X(c))
    this.pair(20, Y(c))
    this.pair(30, 0)
    this.pair(40, r * 1000)
    this.pair(50, a0)
    this.pair(51, a1)
  }
  text(layer: string, p: Vec2, h: number, s: string, rot = 0, center = true) {
    this.pair(0, 'TEXT')
    this.pair(8, layer)
    this.pair(10, X(p))
    this.pair(20, Y(p))
    this.pair(30, 0)
    this.pair(40, h * 1000)
    this.pair(1, enc(s))
    if (rot) this.pair(50, rot)
    if (center) {
      this.pair(72, 1)
      this.pair(73, 2)
      this.pair(11, X(p))
      this.pair(21, Y(p))
      this.pair(31, 0)
    }
  }
}

const X = (p: Vec2) => p.x * 1000
const Y = (p: Vec2) => -p.z * 1000
const deg = (v: Vec2) => (Math.atan2(-v.z, v.x) * 180) / Math.PI

export function buildDxf(room: Room, list: PlacedFurniture[], catalog: Map<string, CatalogItem>) {
  const w = new Writer()
  const floor = room.floor
  const sign = signedArea(floor) < 0 ? -1 : 1
  const outer = outerPolygon(floor, WALL_T)
  const { doors, windows, electric } = tagWallItems(room)
  const opens = [...doors, ...windows]

  floor.forEach((_, i) => {
    const s = wallSegment(floor, i)
    const out = { x: -s.normal.x * sign, z: -s.normal.z * sign }
    const ws = opens.filter((it) => it.wallIndex === i).sort((a, b) => a.offset - b.offset)
    const cuts: [number, number][] = []
    let cur = 0
    for (const it of ws) {
      cuts.push([cur, Math.max(cur, it.offset)])
      cur = Math.max(cur, it.offset + it.width)
    }
    cuts.push([cur, s.length])
    const o0 = outer[i]
    const o1 = outer[(i + 1) % floor.length]
    const olen = Math.hypot(o1.x - o0.x, o1.z - o0.z)
    const startShift = (o0.x - s.a.x) * s.dir.x + (o0.z - s.a.z) * s.dir.z
    for (const [a, b] of cuts) {
      if (b - a < 1e-4 && cuts.length > 1) continue
      w.line('A-WALL', wallPoint(floor, i, a), wallPoint(floor, i, b))
      const oa = a === 0 ? 0 : a - startShift
      const obb = b >= s.length - 1e-6 ? olen : b - startShift
      w.line('A-WALL', { x: o0.x + s.dir.x * oa, z: o0.z + s.dir.z * oa }, { x: o0.x + s.dir.x * obb, z: o0.z + s.dir.z * obb })
    }
    for (const it of ws) {
      for (const off of [it.offset, it.offset + it.width]) {
        const p = wallPoint(floor, i, off)
        w.line('A-WALL', p, { x: p.x + out.x * WALL_T, z: p.z + out.z * WALL_T })
      }
      if (it.type === 'window') {
        for (const k of [0.42, 0.58]) {
          const a = wallPoint(floor, i, it.offset)
          const b = wallPoint(floor, i, it.offset + it.width)
          w.line('A-GLAZ', { x: a.x + out.x * WALL_T * k, z: a.z + out.z * WALL_T * k }, { x: b.x + out.x * WALL_T * k, z: b.z + out.z * WALL_T * k })
        }
        const m = wallPoint(floor, i, it.offset + it.width / 2)
        w.text('A-ANNO', { x: m.x + out.x * 0.35, z: m.z + out.z * 0.35 }, 0.08, it.tag)
      } else {
        const g = doorSwingGeometry(floor, i, it as WallItem, 8)
        const shift = g.swing.side === 'out' ? { x: out.x * WALL_T, z: out.z * WALL_T } : { x: 0, z: 0 }
        const h = { x: g.hinge.x + shift.x, z: g.hinge.z + shift.z }
        const e = { x: g.leafEnd.x + shift.x, z: g.leafEnd.z + shift.z }
        const c0 = { x: g.closedEnd.x + shift.x, z: g.closedEnd.z + shift.z }
        w.line('A-DOOR', h, e)
        let a0 = deg({ x: c0.x - h.x, z: c0.z - h.z })
        let a1 = deg({ x: e.x - h.x, z: e.z - h.z })
        const sweep = (((a1 - a0) % 360) + 360) % 360
        if (sweep > 180.5) [a0, a1] = [a1, a0]
        w.arc('A-DOOR', h, it.width, a0, a1)
        w.text('A-ANNO', { x: (h.x + e.x + c0.x) / 3, z: (h.z + e.z + c0.z) / 3 }, 0.08, it.tag)
      }
    }
    const dimOff = WALL_T + (ws.length ? 0.7 : 0.35)
    const da = { x: s.a.x + out.x * dimOff, z: s.a.z + out.z * dimOff }
    const db = { x: s.b.x + out.x * dimOff, z: s.b.z + out.z * dimOff }
    w.line('A-DIMS', da, db)
    w.line('A-DIMS', { x: s.a.x + out.x * (WALL_T + 0.05), z: s.a.z + out.z * (WALL_T + 0.05) }, { x: da.x + out.x * 0.05, z: da.z + out.z * 0.05 })
    w.line('A-DIMS', { x: s.b.x + out.x * (WALL_T + 0.05), z: s.b.z + out.z * (WALL_T + 0.05) }, { x: db.x + out.x * 0.05, z: db.z + out.z * 0.05 })
    let rot = deg(s.dir)
    if (rot > 90.5) rot -= 180
    if (rot < -89.5) rot += 180
    w.text('A-DIMS', { x: (da.x + db.x) / 2 + out.x * 0.1, z: (da.z + db.z) / 2 + out.z * 0.1 }, 0.1, String(cm(s.length)), rot)
    if (ws.length) {
      const marks = [0, ...ws.flatMap((it) => [it.offset, it.offset + it.width]), s.length]
      const off2 = WALL_T + 0.35
      for (let k = 0; k < marks.length - 1; k++) {
        const p = wallPoint(floor, i, marks[k])
        const q = wallPoint(floor, i, marks[k + 1])
        const pa = { x: p.x + out.x * off2, z: p.z + out.z * off2 }
        const pb = { x: q.x + out.x * off2, z: q.z + out.z * off2 }
        w.line('A-DIMS', pa, pb)
        w.line('A-DIMS', { x: pa.x - out.x * 0.05, z: pa.z - out.z * 0.05 }, { x: pa.x + out.x * 0.05, z: pa.z + out.z * 0.05 })
        if (marks[k + 1] - marks[k] > 0.15) w.text('A-DIMS', { x: (pa.x + pb.x) / 2 + out.x * 0.08, z: (pa.z + pb.z) / 2 + out.z * 0.08 }, 0.07, String(cm(marks[k + 1] - marks[k])), rot)
      }
    }
  })

  for (const e of electric) {
    const s = wallSegment(floor, e.wallIndex)
    const p = wallPoint(floor, e.wallIndex, e.offset + e.width / 2)
    const q = { x: p.x + s.normal.x * sign * 0.1, z: p.z + s.normal.z * sign * 0.1 }
    w.circle('E-POWR', q, 0.05)
    w.text('E-POWR', { x: q.x + s.normal.x * sign * 0.14, z: q.z + s.normal.z * sign * 0.14 }, 0.06, `${e.tag} H${cm(e.elevation + e.height / 2)}`)
  }

  for (const row of furnitureSchedule(room, list, catalog)) {
    w.poly('A-FURN', row.corners)
    const c = row.corners.reduce((acc, p) => ({ x: acc.x + p.x / 4, z: acc.z + p.z / 4 }), { x: 0, z: 0 })
    w.text('A-ANNO', c, 0.09, row.tag)
    w.text('A-ANNO', { x: c.x, z: c.z + 0.13 }, 0.05, `${row.item.name} ${cm(row.dims.width)}x${cm(row.dims.depth)}x${cm(row.dims.height)}`)
  }

  const body = w.out.join('\n')
  const layerTable = LAYERS.map(([n, c]) => `0\nLAYER\n2\n${n}\n70\n0\n62\n${c}\n6\nCONTINUOUS`).join('\n')
  return `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${LAYERS.length}\n${layerTable}\n0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${body}\n0\nENDSEC\n0\nEOF\n`
}
