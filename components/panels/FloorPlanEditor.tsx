'use client'

import { useMemo, useRef, useState } from 'react'
import { useRoomStore } from '@/store/useRoomStore'
import { bbox, round2, validateFloor, wallSegment } from '@/lib/geometry'
import type { Vec2 } from '@/types/room'
import NumberField from '@/components/ui/NumberField'

const SNAP = 0.05

export default function FloorPlanEditor() {
  const open = useRoomStore((s) => s.floorEditorOpen)
  const setOpen = useRoomStore((s) => s.setFloorEditorOpen)
  const floor = useRoomStore((s) => s.room.floor)
  const setFloor = useRoomStore((s) => s.setFloor)
  const insertVertex = useRoomStore((s) => s.insertVertex)
  const deleteVertex = useRoomStore((s) => s.deleteVertex)
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [preview, setPreview] = useState<Vec2[] | null>(null)
  const [frozenBox, setFrozenBox] = useState<ReturnType<typeof bbox> | null>(null)
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null)
  const [selectedWall, setSelectedWall] = useState<number | null>(null)

  const shown = preview ?? floor
  const liveBox = useMemo(() => bbox(floor), [floor])
  const box = frozenBox ?? liveBox
  const pad = Math.max(box.width, box.depth) * 0.25 + 0.6
  const vb = { x: box.minX - pad, y: box.minZ - pad, w: box.width + pad * 2, h: box.depth + pad * 2 }
  const unit = Math.max(vb.w, vb.h) / 60
  const previewErrors = preview ? validateFloor(preview) : []

  if (!open) return null

  const toWorld = (clientX: number, clientY: number): Vec2 | null => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return null
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
    return { x: Math.round(pt.x / SNAP) * SNAP, z: Math.round(pt.y / SNAP) * SNAP }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragIndex === null) return
    const p = toWorld(e.clientX, e.clientY)
    if (!p) return
    const next = floor.map((v, i) => (i === dragIndex ? { x: round2(p.x), z: round2(p.z) } : v))
    setPreview(next)
  }

  const endDrag = () => {
    if (dragIndex === null) return
    if (preview && validateFloor(preview).length === 0) setFloor(preview)
    setPreview(null)
    setDragIndex(null)
    setFrozenBox(null)
  }

  const setWallLength = (i: number, len: number) => {
    const s = wallSegment(floor, i)
    const j = (i + 1) % floor.length
    const next = floor.map((v, k) => (k === j ? { x: round2(s.a.x + s.dir.x * len), z: round2(s.a.z + s.dir.z * len) } : v))
    setFloor(next)
  }

  const gridLines: React.ReactNode[] = []
  for (let x = Math.floor(vb.x); x <= vb.x + vb.w; x += 0.5) {
    gridLines.push(<line key={`x${x}`} x1={x} y1={vb.y} x2={x} y2={vb.y + vb.h} stroke={Number.isInteger(x) ? '#cbd5e1' : '#e2e8f0'} strokeWidth={unit * 0.08} />)
  }
  for (let z = Math.floor(vb.y); z <= vb.y + vb.h; z += 0.5) {
    gridLines.push(<line key={`z${z}`} x1={vb.x} y1={z} x2={vb.x + vb.w} y2={z} stroke={Number.isInteger(z) ? '#cbd5e1' : '#e2e8f0'} strokeWidth={unit * 0.08} />)
  }

  const invalid = previewErrors.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2 sm:p-6">
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">自訂格局（俯視圖）</h2>
            <p className="text-xs text-slate-500">拖曳頂點移動・點牆中間的 ＋ 新增頂點・點頂點後可刪除・每格 0.5m</p>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            完成
          </button>
        </div>
        <div className="relative min-h-0 flex-1 bg-slate-50">
          <svg
            ref={svgRef}
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            className="h-[55vh] w-full touch-none select-none"
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={endDrag}
            onClick={() => {
              setSelectedVertex(null)
              setSelectedWall(null)
            }}
          >
            {gridLines}
            <polygon
              points={shown.map((p) => `${p.x},${p.z}`).join(' ')}
              fill={invalid ? '#fee2e2' : '#e0f2fe'}
              stroke={invalid ? '#ef4444' : '#0f172a'}
              strokeWidth={unit * 0.35}
              strokeLinejoin="round"
            />
            {shown.map((_, i) => {
              const s = wallSegment(shown, i)
              const mx = s.a.x + (s.dir.x * s.length) / 2
              const mz = s.a.z + (s.dir.z * s.length) / 2
              const lx = mx - s.normal.x * unit * 3.6
              const lz = mz - s.normal.z * unit * 3.6
              return (
                <g key={`w${i}`}>
                  <line
                    x1={s.a.x}
                    y1={s.a.z}
                    x2={s.b.x}
                    y2={s.b.z}
                    stroke={selectedWall === i ? '#0284c7' : 'transparent'}
                    strokeWidth={unit * 1.2}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedWall(i)
                      setSelectedVertex(null)
                    }}
                  />
                  <text x={lx} y={lz} fontSize={unit * 1.5} textAnchor="middle" dominantBaseline="middle" fill="#334155" className="pointer-events-none font-semibold">
                    {s.length.toFixed(2)}m
                  </text>
                  <text
                    x={mx + s.normal.x * unit * 3}
                    y={mz + s.normal.z * unit * 3}
                    fontSize={unit * 1.2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#94a3b8"
                    className="pointer-events-none"
                  >
                    牆{i + 1}
                  </text>
                  {dragIndex === null && (
                    <g
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (s.length >= 1.0) insertVertex(i)
                      }}
                    >
                      <circle cx={mx} cy={mz} r={unit * 0.9} fill={s.length >= 1.0 ? '#0ea5e9' : '#cbd5e1'} />
                      <text x={mx} y={mz} fontSize={unit * 1.3} textAnchor="middle" dominantBaseline="central" fill="white" className="pointer-events-none font-bold">
                        +
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
            {shown.map((p, i) => (
              <circle
                key={`v${i}`}
                cx={p.x}
                cy={p.z}
                r={unit * (dragIndex === i ? 1.3 : 1.1)}
                fill={selectedVertex === i ? '#f59e0b' : '#ffffff'}
                stroke="#0f172a"
                strokeWidth={unit * 0.3}
                className="cursor-grab active:cursor-grabbing"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  ;(e.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(e.pointerId)
                  setDragIndex(i)
                  setSelectedVertex(i)
                  setSelectedWall(null)
                  setFrozenBox(liveBox)
                }}
              />
            ))}
          </svg>
          {invalid && (
            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white shadow">
              {previewErrors[0]}（放開後不會套用）
            </div>
          )}
        </div>
        <div className="flex min-h-14 flex-wrap items-end gap-3 border-t border-slate-100 px-4 py-3">
          {selectedVertex !== null && (
            <>
              <span className="text-sm text-slate-600">已選頂點 {selectedVertex + 1}</span>
              <button
                disabled={floor.length <= 3}
                onClick={() => {
                  const next = floor.filter((_, i) => i !== selectedVertex)
                  if (validateFloor(next).length === 0) {
                    deleteVertex(selectedVertex)
                    setSelectedVertex(null)
                  }
                }}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                刪除此頂點
              </button>
            </>
          )}
          {selectedWall !== null && (
            <div className="w-40">
              <NumberField
                key={`${selectedWall}-${floor.length}`}
                label={`牆 ${selectedWall + 1} 長度（移動終點）`}
                value={wallSegment(floor, selectedWall).length}
                validate={(v) => {
                  const s = wallSegment(floor, selectedWall)
                  const j = (selectedWall + 1) % floor.length
                  const next = floor.map((p, k) => (k === j ? { x: s.a.x + s.dir.x * v, z: s.a.z + s.dir.z * v } : p))
                  return validateFloor(next)[0] ?? null
                }}
                onCommit={(v) => setWallLength(selectedWall, v)}
              />
            </div>
          )}
          {selectedVertex === null && selectedWall === null && <span className="text-xs text-slate-400">點選頂點或牆面可以做更多編輯。注意：修改格局後，被分割或合併的牆需要重新確認。</span>}
        </div>
      </div>
    </div>
  )
}
