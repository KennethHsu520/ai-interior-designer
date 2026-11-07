import type { Vec2 } from '@/types/room'
import { MIN_WALL, signedArea, validateFloor, wallSegment } from '@/lib/geometry'

export type FloorLocks = { lengths: boolean[]; angles: boolean[] }
export type FloorEdit = { kind: 'length' | 'angle'; index: number; value: number }
export type SolveResult = { floor: Vec2[] } | { error: string }

const ANGLE_WEIGHT = 4

type Frame = { n: number; sign: number; h0: number; origin: Vec2 }

function toParams(floor: Vec2[]) {
  const n = floor.length
  const sign = signedArea(floor) < 0 ? -1 : 1
  const x: number[] = []
  for (let i = 0; i < n; i++) x.push(wallSegment(floor, i).length)
  for (let i = 0; i < n; i++) {
    const prev = floor[(i - 1 + n) % n]
    const cur = floor[i]
    const next = floor[(i + 1) % n]
    const d1x = cur.x - prev.x
    const d1z = cur.z - prev.z
    const d2x = next.x - cur.x
    const d2z = next.z - cur.z
    const t = Math.atan2(d1x * d2z - d1z * d2x, d1x * d2x + d1z * d2z) * sign
    x.push(Math.PI - t)
  }
  const s0 = wallSegment(floor, 0)
  const frame: Frame = { n, sign, h0: Math.atan2(s0.dir.z, s0.dir.x), origin: floor[0] }
  return { x, frame }
}

function walk(x: number[], f: Frame) {
  const pts: Vec2[] = [f.origin]
  let h = f.h0
  let px = f.origin.x
  let pz = f.origin.z
  for (let i = 0; i < f.n; i++) {
    if (i > 0) h += f.sign * (Math.PI - x[f.n + i])
    px += x[i] * Math.cos(h)
    pz += x[i] * Math.sin(h)
    pts.push({ x: px, z: pz })
  }
  return pts
}

function residual(x: number[], f: Frame) {
  const pts = walk(x, f)
  const end = pts[f.n]
  let turn = 0
  for (let i = 0; i < f.n; i++) turn += Math.PI - x[f.n + i]
  return [end.x - f.origin.x, end.z - f.origin.z, turn - 2 * Math.PI]
}

function solve3(m: number[][], b: number[]) {
  const a = m.map((r, i) => [...r, b[i]])
  for (let c = 0; c < 3; c++) {
    let p = c
    for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r
    ;[a[c], a[p]] = [a[p], a[c]]
    if (Math.abs(a[c][c]) < 1e-14) continue
    for (let r = 0; r < 3; r++) {
      if (r === c) continue
      const k = a[r][c] / a[c][c]
      for (let k2 = c; k2 < 4; k2++) a[r][k2] -= k * a[c][k2]
    }
  }
  return a.map((r, i) => (Math.abs(r[i]) < 1e-14 ? 0 : r[3] / r[i]))
}

function norm(v: number[]) {
  return Math.hypot(...v)
}

function solveWith(x0: number[], free: number[], f: Frame) {
  if (free.length === 0) return norm(residual(x0, f)) < 1e-7 ? x0 : null
  const x = x0.slice()
  const winv = free.map((j) => (j >= f.n ? 1 / ANGLE_WEIGHT : 1))
  for (let it = 0; it < 80; it++) {
    const g = residual(x, f)
    if (norm(g) < 1e-10) break
    const J: number[][] = [[], [], []]
    free.forEach((j) => {
      const eps = 1e-7
      const xp = x.slice()
      xp[j] += eps
      const gp = residual(xp, f)
      for (let r = 0; r < 3; r++) J[r].push((gp[r] - g[r]) / eps)
    })
    const M = [0, 1, 2].map((r) => [0, 1, 2].map((c) => J[r].reduce((acc, v, k) => acc + v * J[c][k] * winv[k], 0) + (r === c ? 1e-12 : 0)))
    const y = solve3(M, g)
    free.forEach((j, k) => {
      x[j] -= winv[k] * (J[0][k] * y[0] + J[1][k] * y[1] + J[2][k] * y[2])
    })
    if (x.some((v) => !Number.isFinite(v))) return null
  }
  return norm(residual(x, f)) < 1e-6 ? x : null
}

function toFloor(x: number[], f: Frame) {
  return walk(x, f)
    .slice(0, f.n)
    .map((p) => ({ x: Math.round(p.x * 10000) / 10000, z: Math.round(p.z * 10000) / 10000 }))
}

function isValid(x: number[], f: Frame) {
  for (let i = 0; i < f.n; i++) {
    if (x[i] < MIN_WALL - 1e-6) return false
    const a = x[f.n + i]
    if (a <= 0.01 || a >= 2 * Math.PI - 0.01) return false
  }
  return validateFloor(toFloor(x, f)).length === 0
}

function cost(x: number[], x0: number[], f: Frame) {
  return x.reduce((acc, v, j) => acc + (j >= f.n ? ANGLE_WEIGHT : 1) * (v - x0[j]) ** 2, 0)
}

export function solveFloor(floor: Vec2[], edit: FloorEdit, locks: FloorLocks): SolveResult {
  const { x: base, frame } = toParams(floor)
  const n = frame.n
  const target = edit.kind === 'length' ? edit.index : n + edit.index
  const x0 = base.slice()
  x0[target] = edit.kind === 'length' ? edit.value : (edit.value * Math.PI) / 180
  const freeLen: number[] = []
  const freeAng: number[] = []
  for (let i = 0; i < n; i++) {
    if (i !== target && !locks.lengths[i]) freeLen.push(i)
    if (n + i !== target && !locks.angles[i]) freeAng.push(n + i)
  }
  const tiers: number[][][] =
    edit.kind === 'length' ? [[freeLen], [[...freeLen, ...freeAng]]] : [freeAng.map((a) => [...freeLen, a]), [[...freeLen, ...freeAng]]]
  let anySolved = false
  for (const tier of tiers) {
    let best: number[] | null = null
    let bestCost = Infinity
    for (const free of tier) {
      const x = solveWith(x0, free, frame)
      if (!x) continue
      anySolved = true
      if (!isValid(x, frame)) continue
      const c = cost(x, x0, frame)
      if (c < bestCost) {
        bestCost = c
        best = x
      }
    }
    if (best) return { floor: toFloor(best, frame) }
  }
  return { error: anySolved ? '這個數值會讓牆太短或格局交叉' : '鎖定的項目太多，無法閉合，請解鎖一些長度或角度' }
}

export function locksOf(walls: { lengthLocked?: boolean; angleLocked?: boolean }[], n: number): FloorLocks {
  return {
    lengths: Array.from({ length: n }, (_, i) => !!walls[i]?.lengthLocked),
    angles: Array.from({ length: n }, (_, i) => !!walls[i]?.angleLocked),
  }
}

export function lockViolation(before: Vec2[], after: Vec2[], locks: FloorLocks): string | null {
  const n = before.length
  if (after.length !== n) return null
  for (let i = 0; i < n; i++) {
    if (locks.lengths[i] && Math.abs(wallSegment(before, i).length - wallSegment(after, i).length) > 0.005) return `牆 ${i + 1} 的長度已鎖定`
  }
  const { x: xb } = toParams(before)
  const { x: xa } = toParams(after)
  for (let i = 0; i < n; i++) {
    if (locks.angles[i] && Math.abs(xb[n + i] - xa[n + i]) > 0.001) return `牆 ${((i - 1 + n) % n) + 1}／牆 ${i + 1} 的轉角已鎖定`
  }
  return null
}

function circumcircle(a: Vec2, b: Vec2, c: Vec2) {
  const d = 2 * (a.x * (b.z - c.z) + b.x * (c.z - a.z) + c.x * (a.z - b.z))
  if (Math.abs(d) < 1e-9) return null
  const a2 = a.x * a.x + a.z * a.z
  const b2 = b.x * b.x + b.z * b.z
  const c2 = c.x * c.x + c.z * c.z
  const center = { x: (a2 * (b.z - c.z) + b2 * (c.z - a.z) + c2 * (a.z - b.z)) / d, z: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d }
  return { center, r: Math.hypot(a.x - center.x, a.z - center.z) }
}

type Curve = { kind: 'line'; p: Vec2; dir: Vec2 } | { kind: 'circle'; center: Vec2; r: number }

function projectCurve(c: Curve, t: Vec2): Vec2 {
  if (c.kind === 'line') {
    const k = (t.x - c.p.x) * c.dir.x + (t.z - c.p.z) * c.dir.z
    return { x: c.p.x + c.dir.x * k, z: c.p.z + c.dir.z * k }
  }
  const dx = t.x - c.center.x
  const dz = t.z - c.center.z
  const l = Math.hypot(dx, dz) || 1
  return { x: c.center.x + (dx / l) * c.r, z: c.center.z + (dz / l) * c.r }
}

export function constrainVertex(floor: Vec2[], i: number, target: Vec2, locks: FloorLocks): Vec2 | null {
  const n = floor.length
  const ip = (i - 1 + n) % n
  const inx = (i + 1) % n
  const prev = floor[ip]
  const next = floor[inx]
  const cur = floor[i]
  const unit = (from: Vec2, to: Vec2) => {
    const l = Math.hypot(to.x - from.x, to.z - from.z) || 1
    return { x: (to.x - from.x) / l, z: (to.z - from.z) / l }
  }
  const curves: Curve[] = []
  if (locks.lengths[ip]) curves.push({ kind: 'circle', center: prev, r: Math.hypot(cur.x - prev.x, cur.z - prev.z) })
  if (locks.lengths[i]) curves.push({ kind: 'circle', center: next, r: Math.hypot(cur.x - next.x, cur.z - next.z) })
  if (locks.angles[ip]) curves.push({ kind: 'line', p: prev, dir: unit(prev, cur) })
  if (locks.angles[inx]) curves.push({ kind: 'line', p: next, dir: unit(next, cur) })
  if (locks.angles[i]) {
    const cc = circumcircle(prev, cur, next)
    if (cc) curves.push({ kind: 'circle', center: cc.center, r: cc.r })
    else curves.push({ kind: 'line', p: prev, dir: unit(prev, next) })
  }
  if (curves.length === 0) return target
  if (curves.length > 1) return null
  return projectCurve(curves[0], target)
}
