'use client'

import type { ReactNode } from 'react'
import { cm, swingText, type Tagged } from '@/lib/planData'
import type { WallItem } from '@/types/room'

export type ElevationFurniture = { tag: string; offset: number; width: number; height: number }

function HDim({ x1, x2, y, u, label }: { x1: number; x2: number; y: number; u: number; label: string }) {
  const tk = u * 0.9
  return (
    <g>
      <line x1={x1} y1={y - u * 1.5} x2={x1} y2={y + u * 1.5} stroke="#334155" strokeWidth={u * 0.13} />
      <line x1={x2} y1={y - u * 1.5} x2={x2} y2={y + u * 1.5} stroke="#334155" strokeWidth={u * 0.13} />
      <line x1={x1 - u} y1={y} x2={x2 + u} y2={y} stroke="#334155" strokeWidth={u * 0.18} />
      <line x1={x1 - tk} y1={y + tk} x2={x1 + tk} y2={y - tk} stroke="#0f172a" strokeWidth={u * 0.35} />
      <line x1={x2 - tk} y1={y + tk} x2={x2 + tk} y2={y - tk} stroke="#0f172a" strokeWidth={u * 0.35} />
      {x2 - x1 > u * 4 && (
        <text x={(x1 + x2) / 2} y={y - u * 1.2} fontSize={u * 2.1} textAnchor="middle" fill="#0f172a">
          {label}
        </text>
      )}
    </g>
  )
}

function VDim({ x, y1, y2, u, label }: { x: number; y1: number; y2: number; u: number; label: string }) {
  const tk = u * 0.9
  return (
    <g>
      <line x1={x - u * 1.5} y1={y1} x2={x + u * 1.5} y2={y1} stroke="#334155" strokeWidth={u * 0.13} />
      <line x1={x - u * 1.5} y1={y2} x2={x + u * 1.5} y2={y2} stroke="#334155" strokeWidth={u * 0.13} />
      <line x1={x} y1={y1 + u} x2={x} y2={y2 - u} stroke="#334155" strokeWidth={u * 0.18} />
      <line x1={x - tk} y1={y1 + tk} x2={x + tk} y2={y1 - tk} stroke="#0f172a" strokeWidth={u * 0.35} />
      <line x1={x - tk} y1={y2 + tk} x2={x + tk} y2={y2 - tk} stroke="#0f172a" strokeWidth={u * 0.35} />
      {Math.abs(y2 - y1) > u * 4 && (
        <text x={x - u * 1.2} y={(y1 + y2) / 2} fontSize={u * 2.1} textAnchor="middle" fill="#0f172a" transform={`rotate(-90 ${x - u * 1.2} ${(y1 + y2) / 2})`}>
          {label}
        </text>
      )}
    </g>
  )
}

export default function ElevationDrawing({
  length,
  height,
  items,
  furniture,
  scale,
}: {
  length: number
  height: number
  items: Tagged<WallItem>[]
  furniture: ElevationFurniture[]
  scale: number
}) {
  const u = scale / 10
  const L = length * 100
  const H = height * 100
  const Y = (e: number) => H - e * 100
  const opens = items.filter((it) => it.type === 'door' || it.type === 'window').sort((a, b) => a.offset - b.offset)
  const marks = [0, ...opens.flatMap((it) => [Math.max(0, it.offset), Math.min(length, it.offset + it.width)]), length].filter(
    (v, k, arr) => k === 0 || Math.abs(v - arr[k - 1]) > 0.005,
  )
  const small = items.filter((it) => it.type !== 'door' && it.type !== 'window')
  const margin = { l: u * 16, r: u * 10, t: u * 8, b: u * 22 }
  const vb = { x: -margin.l, y: -margin.t, w: L + margin.l + margin.r, h: H + margin.t + margin.b }
  const nodes: ReactNode[] = []

  for (const it of items) {
    const x = it.offset * 100
    const w = it.width * 100
    const y = Y(it.elevation + it.height)
    const h = it.height * 100
    if (it.type === 'door') {
      const hingeLeft = (it.swing?.hinge ?? 'start') === 'start'
      const hx = hingeLeft ? x : x + w
      const ox = hingeLeft ? x + w : x
      nodes.push(
        <g key={it.id}>
          <rect x={x} y={y} width={w} height={h} fill="#fff7ed" stroke="#0f172a" strokeWidth={u * 0.35} />
          <polyline points={`${ox},${y} ${hx},${y + h / 2} ${ox},${y + h}`} fill="none" stroke="#b45309" strokeWidth={u * 0.18} strokeDasharray={`${u * 1.2} ${u * 0.6}`} />
          <circle cx={ox + (hingeLeft ? -u * 2.5 : u * 2.5)} cy={Y(1.0)} r={u * 0.6} fill="#475569" />
          <text x={x + w / 2} y={y + u * 3} fontSize={u * 2} textAnchor="middle" fill="#b45309" fontWeight={700}>
            {it.tag}
          </text>
        </g>,
      )
    } else if (it.type === 'window') {
      nodes.push(
        <g key={it.id}>
          <rect x={x} y={y} width={w} height={h} fill="#eff6ff" stroke="#0f172a" strokeWidth={u * 0.35} />
          <rect x={x + u} y={y + u} width={w - u * 2} height={h - u * 2} fill="none" stroke="#0369a1" strokeWidth={u * 0.15} />
          <line x1={x + w / 2} y1={y + u} x2={x + w / 2} y2={y + h - u} stroke="#0369a1" strokeWidth={u * 0.15} />
          <text x={x + w / 2} y={y + h / 2} fontSize={u * 2} textAnchor="middle" dominantBaseline="middle" fill="#0369a1" fontWeight={700}>
            {it.tag}
          </text>
        </g>,
      )
    } else {
      const color = it.type === 'air_conditioner' ? '#0e7490' : it.type === 'light' ? '#ca8a04' : it.type === 'furniture' ? '#64748b' : '#7c3aed'
      nodes.push(
        <g key={it.id}>
          <rect x={x} y={y} width={Math.max(w, u)} height={Math.max(h, u)} fill="#fff" stroke={color} strokeWidth={u * 0.3} />
          <text x={x + w / 2} y={y - u * 1.2} fontSize={u * 1.7} textAnchor="middle" fill={color} fontWeight={700}>
            {it.tag}
          </text>
        </g>,
      )
    }
  }

  return (
    <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} style={{ width: `${(vb.w * 10) / scale}mm`, height: `${(vb.h * 10) / scale}mm` }} fontFamily="'Noto Sans TC', 'Microsoft JhengHei', sans-serif">
      <rect x={0} y={0} width={L} height={H} fill="#fafafa" stroke="#0f172a" strokeWidth={u * 0.5} />
      <line x1={-u * 4} y1={H} x2={L + u * 4} y2={H} stroke="#0f172a" strokeWidth={u * 0.8} />
      <text x={L + u * 1} y={H - u * 0.8} fontSize={u * 1.6} fill="#64748b">
        FL±0
      </text>
      <text x={L + u * 1} y={-u * 0.8} fontSize={u * 1.6} fill="#64748b">
        CH {cm(height)}
      </text>
      {furniture.map((f) => (
        <g key={f.tag}>
          <rect x={f.offset * 100} y={Y(f.height)} width={f.width * 100} height={f.height * 100} fill="none" stroke="#94a3b8" strokeWidth={u * 0.2} strokeDasharray={`${u * 1.2} ${u * 0.6}`} />
          <text x={f.offset * 100 + (f.width * 100) / 2} y={Y(f.height) + u * 2.6} fontSize={u * 1.7} textAnchor="middle" fill="#64748b">
            {f.tag}
          </text>
        </g>
      ))}
      {nodes}
      {marks.length > 2 &&
        marks.slice(0, -1).map((m, k) => <HDim key={`h${k}`} x1={m * 100} x2={marks[k + 1] * 100} y={H + u * 6} u={u} label={`${cm(marks[k + 1] - m)}`} />)}
      <HDim x1={0} x2={L} y={H + u * (marks.length > 2 ? 12 : 6)} u={u} label={`${cm(length)}`} />
      <VDim x={-u * 5} y1={0} y2={H} u={u} label={`${cm(height)}`} />
      {opens.map((it, k) => (
        <VDim key={`v${it.id}`} x={-u * (10 + (k % 2) * 3)} y1={Y(it.elevation + it.height)} y2={Y(it.elevation)} u={u} label={`${cm(it.height)}`} />
      ))}
      {opens
        .filter((it) => it.elevation > 0.01)
        .map((it) => (
          <VDim key={`s${it.id}`} x={it.offset * 100 + it.width * 100 + u * 2.5} y1={Y(it.elevation)} y2={H} u={u} label={`${cm(it.elevation)}`} />
        ))}
      {small.map((it) => (
        <VDim key={`e${it.id}`} x={it.offset * 100 + it.width * 100 + u * 2.2} y1={Y(it.elevation + it.height / 2)} y2={H} u={u} label={`${cm(it.elevation + it.height / 2)}`} />
      ))}
      {opens.map((it) =>
        it.type === 'door' ? (
          <text key={`sw${it.id}`} x={it.offset * 100 + (it.width * 100) / 2} y={Y(it.elevation + it.height) + u * 5.5} fontSize={u * 1.6} textAnchor="middle" fill="#b45309">
            {swingText(it)}
          </text>
        ) : null,
      )}
    </svg>
  )
}
