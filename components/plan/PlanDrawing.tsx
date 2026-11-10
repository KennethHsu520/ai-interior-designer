'use client'

import type { ReactNode } from 'react'
import type { CeilingItem, Room, Vec2 } from '@/types/room'
import { bbox, doorSwingGeometry, signedArea, wallPoint, wallSegment } from '@/lib/geometry'
import { cm, outerPolygon, WALL_T, type Tagged } from '@/lib/planData'
import type { WallItem } from '@/types/room'

export const SCALES = [20, 25, 30, 50, 75, 100, 150, 200]

export function pickScale(widthCm: number, heightCm: number, paperW: number, paperH: number, marginW = 0, marginH = 0) {
  return SCALES.find((s) => (widthCm * 10) / s + marginW <= paperW && (heightCm * 10) / s + marginH <= paperH) ?? 200
}

const P = (v: Vec2) => ({ x: v.x * 100, y: v.z * 100 })
const pts = (vs: Vec2[]) => vs.map((v) => `${v.x * 100},${v.z * 100}`).join(' ')

function textAngle(dx: number, dy: number) {
  let a = (Math.atan2(dy, dx) * 180) / Math.PI
  if (a > 90.5) a -= 180
  if (a < -89.5) a += 180
  return a
}

export function Dim({ a, b, n, off, start, label, u, color = '#1d1d1f' }: { a: Vec2; b: Vec2; n: Vec2; off: number; start: number; label: string; u: number; color?: string }) {
  const A = P(a)
  const B = P(b)
  const o = off
  const pa = { x: A.x + n.x * o, y: A.y + n.z * o }
  const pb = { x: B.x + n.x * o, y: B.y + n.z * o }
  const ea0 = { x: A.x + n.x * start, y: A.y + n.z * start }
  const eb0 = { x: B.x + n.x * start, y: B.y + n.z * start }
  const ext = u * 1.5
  const dx = pb.x - pa.x
  const dy = pb.y - pa.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const tk = u * 1.2
  const tick = (p: { x: number; y: number }) => (
    <line x1={p.x - (ux + n.x) * tk * 0.7} y1={p.y - (uy + n.z) * tk * 0.7} x2={p.x + (ux + n.x) * tk * 0.7} y2={p.y + (uy + n.z) * tk * 0.7} stroke={color} strokeWidth={u * 0.35} />
  )
  const mid = { x: (pa.x + pb.x) / 2 + n.x * u * 1.6, y: (pa.y + pb.y) / 2 + n.z * u * 1.6 }
  return (
    <g>
      <line x1={ea0.x} y1={ea0.y} x2={pa.x + n.x * ext} y2={pa.y + n.z * ext} stroke={color} strokeWidth={u * 0.13} />
      <line x1={eb0.x} y1={eb0.y} x2={pb.x + n.x * ext} y2={pb.y + n.z * ext} stroke={color} strokeWidth={u * 0.13} />
      <line x1={pa.x - ux * ext} y1={pa.y - uy * ext} x2={pb.x + ux * ext} y2={pb.y + uy * ext} stroke={color} strokeWidth={u * 0.18} />
      {tick(pa)}
      {tick(pb)}
      {len > u * 4 && (
        <text x={mid.x} y={mid.y} fontSize={u * 2.3} textAnchor="middle" dominantBaseline="middle" fill={color} transform={`rotate(${textAngle(dx, dy)} ${mid.x} ${mid.y})`}>
          {label}
        </text>
      )}
    </g>
  )
}

function centroid(poly: Vec2[]) {
  let a = 0
  let cx = 0
  let cz = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const f = p.x * q.z - q.x * p.z
    a += f
    cx += (p.x + q.x) * f
    cz += (p.z + q.z) * f
  }
  a /= 2
  return { x: cx / (6 * a), z: cz / (6 * a) }
}

export type PlanFurniture = { tag: string; corners: Vec2[]; rug: boolean; front: Vec2[] }

export default function PlanDrawing({
  room,
  furniture,
  doors,
  windows,
  electric,
  ceiling,
  scale,
  showFurniture = true,
  title,
}: {
  room: Room
  furniture: PlanFurniture[]
  doors: Tagged<WallItem>[]
  windows: Tagged<WallItem>[]
  electric: Tagged<WallItem>[]
  ceiling: CeilingItem[]
  scale: number
  showFurniture?: boolean
  title?: string
}) {
  const floor = room.floor
  const u = scale / 10
  const sign = signedArea(floor) < 0 ? -1 : 1
  const outer = outerPolygon(floor, WALL_T)
  const ob = bbox(outer)
  const margin = u * 26
  const vb = { x: ob.minX * 100 - margin, y: ob.minZ * 100 - margin, w: ob.width * 100 + margin * 2, h: ob.depth * 100 + margin * 2 }
  const T = WALL_T * 100
  const nodes: ReactNode[] = []

  floor.forEach((_, i) => {
    const s = wallSegment(floor, i)
    const out = { x: -s.normal.x * sign, z: -s.normal.z * sign }
    const opens = [...doors, ...windows].filter((it) => it.wallIndex === i).sort((p, q) => p.offset - q.offset)
    const marks = [0, ...opens.flatMap((it) => [Math.max(0, it.offset), Math.min(s.length, it.offset + it.width)]), s.length]
      .filter((v, k, arr) => k === 0 || Math.abs(v - arr[k - 1]) > 0.005)
    if (opens.length) {
      for (let k = 0; k < marks.length - 1; k++) {
        nodes.push(
          <Dim
            key={`c${i}-${k}`}
            a={wallPoint(floor, i, marks[k])}
            b={wallPoint(floor, i, marks[k + 1])}
            n={out}
            start={T + u * 1.5}
            off={T + u * 7}
            label={`${cm(marks[k + 1] - marks[k])}`}
            u={u}
            color="#424245"
          />,
        )
      }
    }
    nodes.push(<Dim key={`t${i}`} a={s.a} b={s.b} n={out} start={T + u * 1.5} off={T + u * (opens.length ? 14 : 7)} label={`${cm(s.length)}`} u={u} />)
    const mid = wallPoint(floor, i, s.length / 2, -0.001)
    const inP = { x: mid.x * 100 + s.normal.x * sign * u * 5, y: mid.z * 100 + s.normal.z * sign * u * 5 }
    nodes.push(
      <g key={`wn${i}`}>
        <circle cx={inP.x} cy={inP.y} r={u * 2.4} fill="#fff" stroke="#1d1d1f" strokeWidth={u * 0.2} />
        <text x={inP.x} y={inP.y} fontSize={u * 2} textAnchor="middle" dominantBaseline="central" fill="#1d1d1f" fontWeight={700}>
          {i + 1}
        </text>
      </g>,
    )
  })

  const openingCut = (it: Tagged<WallItem>) => {
    const s = wallSegment(floor, it.wallIndex)
    const out = { x: -s.normal.x * sign * WALL_T, z: -s.normal.z * sign * WALL_T }
    const a = wallPoint(floor, it.wallIndex, it.offset)
    const b = wallPoint(floor, it.wallIndex, it.offset + it.width)
    const a2 = { x: a.x + out.x, z: a.z + out.z }
    const b2 = { x: b.x + out.x, z: b.z + out.z }
    return { a, b, a2, b2, out }
  }

  return (
    <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} style={{ width: `${(vb.w * 10) / scale}mm`, height: `${(vb.h * 10) / scale}mm` }} fontFamily="'Noto Sans TC', 'Microsoft JhengHei', sans-serif">
      <path d={`M ${pts(outer).replace(/ /g, ' L ')} Z M ${pts(floor).replace(/ /g, ' L ')} Z`} fill="#424245" fillRule="evenodd" stroke="#1d1d1f" strokeWidth={u * 0.35} />
      {[...windows, ...doors].map((it) => {
        const c = openingCut(it)
        return <polygon key={`cut${it.id}`} points={pts([c.a, c.b, c.b2, c.a2])} fill="#ffffff" />
      })}
      {windows.map((it) => {
        const c = openingCut(it)
        const lines = [0, 0.42, 0.58, 1].map((k) => [
          { x: c.a.x + c.out.x * k, z: c.a.z + c.out.z * k },
          { x: c.b.x + c.out.x * k, z: c.b.z + c.out.z * k },
        ])
        const m = { x: (c.a2.x + c.b2.x) / 2, z: (c.a2.z + c.b2.z) / 2 }
        return (
          <g key={`w${it.id}`}>
            <polygon points={pts([c.a, c.b, c.b2, c.a2])} fill="none" stroke="#1d1d1f" strokeWidth={u * 0.25} />
            {lines.map(([p, q], k) => (
              <line key={k} x1={p.x * 100} y1={p.z * 100} x2={q.x * 100} y2={q.z * 100} stroke="#1d1d1f" strokeWidth={u * (k === 1 || k === 2 ? 0.25 : 0.18)} />
            ))}
            <text x={m.x * 100 + c.out.x * 100 * 0.6} y={m.z * 100 + c.out.z * 100 * 0.6} fontSize={u * 2} textAnchor="middle" dominantBaseline="middle" fill="#0369a1" fontWeight={700}>
              {it.tag}
            </text>
          </g>
        )
      })}
      {doors.map((it) => {
        const c = openingCut(it)
        const g = doorSwingGeometry(floor, it.wallIndex, it, 32)
        const shift = g.swing.side === 'out' ? c.out : { x: 0, z: 0 }
        const mv = (p: Vec2) => ({ x: p.x + shift.x, z: p.z + shift.z })
        const arc = g.arc.map(mv)
        const hinge = mv(g.hinge)
        const end = arc[arc.length - 1]
        const lp = P(mv({ x: (g.hinge.x + g.leafEnd.x + g.arc[Math.floor(g.arc.length / 2)].x) / 3, z: (g.hinge.z + g.leafEnd.z + g.arc[Math.floor(g.arc.length / 2)].z) / 3 }))
        return (
          <g key={`d${it.id}`}>
            <line x1={c.a.x * 100} y1={c.a.z * 100} x2={c.a2.x * 100} y2={c.a2.z * 100} stroke="#1d1d1f" strokeWidth={u * 0.3} />
            <line x1={c.b.x * 100} y1={c.b.z * 100} x2={c.b2.x * 100} y2={c.b2.z * 100} stroke="#1d1d1f" strokeWidth={u * 0.3} />
            <polyline points={pts(arc)} fill="none" stroke="#1d1d1f" strokeWidth={u * 0.15} strokeDasharray={`${u * 1.2} ${u * 0.6}`} />
            <line x1={hinge.x * 100} y1={hinge.z * 100} x2={end.x * 100} y2={end.z * 100} stroke="#1d1d1f" strokeWidth={u * 0.5} />
            <text x={lp.x} y={lp.y} fontSize={u * 2} textAnchor="middle" dominantBaseline="middle" fill="#8e4c31" fontWeight={700}>
              {it.tag}
            </text>
          </g>
        )
      })}
      {nodes}
      {showFurniture &&
        furniture.map((f) => {
          const c = f.corners.reduce((acc, p) => ({ x: acc.x + p.x / 4, z: acc.z + p.z / 4 }), { x: 0, z: 0 })
          return (
            <g key={f.tag}>
              <polygon points={pts(f.corners)} fill={f.rug ? 'none' : '#fbfaf8'} stroke="#424245" strokeWidth={u * (f.rug ? 0.15 : 0.3)} strokeDasharray={f.rug ? `${u * 1} ${u * 0.6}` : undefined} />
              {!f.rug && <line x1={f.front[0].x * 100} y1={f.front[0].z * 100} x2={f.front[1].x * 100} y2={f.front[1].z * 100} stroke="#424245" strokeWidth={u * 0.6} />}
              <circle cx={c.x * 100} cy={c.z * 100} r={u * 2.6} fill="#fff" stroke="#1d1d1f" strokeWidth={u * 0.18} />
              <text x={c.x * 100} y={c.z * 100} fontSize={u * 1.9} textAnchor="middle" dominantBaseline="central" fill="#1d1d1f" fontWeight={700}>
                {f.tag}
              </text>
            </g>
          )
        })}
      {electric.map((it) => {
        const s = wallSegment(floor, it.wallIndex)
        const inN = { x: s.normal.x * sign, z: s.normal.z * sign }
        const p = wallPoint(floor, it.wallIndex, it.offset + it.width / 2)
        const q = { x: p.x * 100 + inN.x * u * 2.2, y: p.z * 100 + inN.z * u * 2.2 }
        const r = u * 1.6
        const rot = (Math.atan2(s.dir.z, s.dir.x) * 180) / Math.PI
        let sym: ReactNode
        if (it.type === 'outlet')
          sym = (
            <>
              <circle cx={q.x} cy={q.y} r={r} fill="#fff" stroke="#7c3aed" strokeWidth={u * 0.22} />
              <line x1={q.x - r * 0.45} y1={q.y - r * 0.5} x2={q.x - r * 0.45} y2={q.y + r * 0.5} stroke="#7c3aed" strokeWidth={u * 0.22} transform={`rotate(${rot} ${q.x} ${q.y})`} />
              <line x1={q.x + r * 0.45} y1={q.y - r * 0.5} x2={q.x + r * 0.45} y2={q.y + r * 0.5} stroke="#7c3aed" strokeWidth={u * 0.22} transform={`rotate(${rot} ${q.x} ${q.y})`} />
            </>
          )
        else if (it.type === 'switch')
          sym = (
            <>
              <circle cx={q.x} cy={q.y} r={r} fill="#fff" stroke="#7c3aed" strokeWidth={u * 0.22} />
              <text x={q.x} y={q.y} fontSize={r * 1.3} textAnchor="middle" dominantBaseline="central" fill="#7c3aed" fontWeight={700}>
                S
              </text>
            </>
          )
        else if (it.type === 'air_conditioner') {
          const a = wallPoint(floor, it.wallIndex, it.offset, 0.02)
          const b = wallPoint(floor, it.wallIndex, it.offset + it.width, 0.02)
          const a2 = wallPoint(floor, it.wallIndex, it.offset, 0.25)
          const b2 = wallPoint(floor, it.wallIndex, it.offset + it.width, 0.25)
          sym = (
            <>
              <polygon points={pts([a, b, b2, a2])} fill="#ecfeff" stroke="#0e7490" strokeWidth={u * 0.22} strokeDasharray={`${u} ${u * 0.5}`} />
              <text x={q.x + inN.x * u * 1.5} y={q.y + inN.z * u * 1.5} fontSize={u * 1.8} textAnchor="middle" dominantBaseline="central" fill="#0e7490" fontWeight={700}>
                AC
              </text>
            </>
          )
        } else
          sym = (
            <>
              <circle cx={q.x} cy={q.y} r={r} fill="#fff" stroke="#ca8a04" strokeWidth={u * 0.22} />
              <line x1={q.x - r * 0.7} y1={q.y - r * 0.7} x2={q.x + r * 0.7} y2={q.y + r * 0.7} stroke="#ca8a04" strokeWidth={u * 0.2} />
              <line x1={q.x + r * 0.7} y1={q.y - r * 0.7} x2={q.x - r * 0.7} y2={q.y + r * 0.7} stroke="#ca8a04" strokeWidth={u * 0.2} />
            </>
          )
        return (
          <g key={`e${it.id}`}>
            {sym}
            <text x={q.x + inN.x * u * 3.6} y={q.y + inN.z * u * 3.6} fontSize={u * 1.6} textAnchor="middle" dominantBaseline="central" fill="#6d28d9">
              {it.tag}
            </text>
          </g>
        )
      })}
      {ceiling.map((c) => {
        const x = c.x * 100
        const y = c.z * 100
        if (c.type === 'air_conditioner')
          return (
            <g key={c.id}>
              <rect x={x - c.width * 50} y={y - c.depth * 50} width={c.width * 100} height={c.depth * 100} fill="none" stroke="#0e7490" strokeWidth={u * 0.2} strokeDasharray={`${u * 1.2} ${u * 0.6}`} />
              <text x={x} y={y} fontSize={u * 1.6} textAnchor="middle" dominantBaseline="central" fill="#0e7490">
                天花 AC
              </text>
            </g>
          )
        const r = u * 2.2
        return (
          <g key={c.id}>
            <circle cx={x} cy={y} r={r} fill="none" stroke="#ca8a04" strokeWidth={u * 0.22} />
            <line x1={x - r * 0.7} y1={y - r * 0.7} x2={x + r * 0.7} y2={y + r * 0.7} stroke="#ca8a04" strokeWidth={u * 0.2} />
            <line x1={x + r * 0.7} y1={y - r * 0.7} x2={x - r * 0.7} y2={y + r * 0.7} stroke="#ca8a04" strokeWidth={u * 0.2} />
          </g>
        )
      })}
      {title !== undefined && (() => {
        const c = centroid(floor)
        const area = Math.abs(signedArea(floor))
        return (
          <g>
            <text x={c.x * 100} y={c.z * 100 - u * 2} fontSize={u * 3} textAnchor="middle" fill="#1d1d1f" fontWeight={700} paintOrder="stroke" stroke="#fff" strokeWidth={u * 0.8}>
              {title}
            </text>
            <text x={c.x * 100} y={c.z * 100 + u * 1.8} fontSize={u * 2.1} textAnchor="middle" fill="#424245" paintOrder="stroke" stroke="#fff" strokeWidth={u * 0.8}>
              {area.toFixed(2)} m²（{(area / 3.3058).toFixed(2)} 坪）・淨高 {cm(room.height)}
            </text>
          </g>
        )
      })()}
      <g transform={`translate(${vb.x + u * 6} ${vb.y + vb.h - u * 6})`}>
        {[0, 1, 2, 3, 4].map((k) => (
          <rect key={k} x={k * 50} y={-u * 1.2} width={50} height={u * 1.2} fill={k % 2 ? '#fff' : '#1d1d1f'} stroke="#1d1d1f" strokeWidth={u * 0.12} />
        ))}
        {[0, 100, 200].map((v) => (
          <text key={v} x={v * 1} y={-u * 2.2} fontSize={u * 1.8} textAnchor="middle" fill="#1d1d1f">
            {v}
          </text>
        ))}
        <text x={250 + u * 2} y={-u * 0.3} fontSize={u * 1.8} fill="#1d1d1f">
          cm
        </text>
      </g>
    </svg>
  )
}
