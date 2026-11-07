'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRoomStore } from '@/store/useRoomStore'
import {
  bbox,
  cornerAngle,
  cornerLabelPoint,
  doorSwingGeometry,
  formatAngle,
  moveWallParallel,
  projectOnWall,
  wallPoint,
  round2,
  validateFloor,
  wallSegment,
} from '@/lib/geometry'
import { constrainVertex, lockViolation, locksOf, solveFloor, type FloorEdit } from '@/lib/floorSolver'
import type { Vec2, Wall } from '@/types/room'
import NumberField from '@/components/ui/NumberField'

const SNAP = 0.01

type Drag = { kind: 'vertex'; index: number } | { kind: 'wall'; index: number; start: Vec2 }
type Snapshot = { floor: Vec2[]; walls: Wall[] }
type Selection = { kind: 'wall' | 'vertex'; index: number } | null

export default function FloorPlanEditor() {
  const open = useRoomStore((s) => s.floorEditorOpen)
  const setOpen = useRoomStore((s) => s.setFloorEditorOpen)
  const floor = useRoomStore((s) => s.room.floor)
  const walls = useRoomStore((s) => s.room.walls)
  const setFloor = useRoomStore((s) => s.setFloor)
  const insertVertex = useRoomStore((s) => s.insertVertex)
  const deleteVertex = useRoomStore((s) => s.deleteVertex)
  const setWallLock = useRoomStore((s) => s.setWallLock)
  const setAllLocks = useRoomStore((s) => s.setAllLocks)
  const restoreLayout = useRoomStore((s) => s.restoreLayout)
  const svgRef = useRef<SVGSVGElement>(null)
  const draggedRef = useRef(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [preview, setPreview] = useState<Vec2[] | null>(null)
  const [moveDist, setMoveDist] = useState(0)
  const [frozenBox, setFrozenBox] = useState<ReturnType<typeof bbox> | null>(null)
  const [sel, setSel] = useState<Selection>(null)
  const [past, setPast] = useState<Snapshot[]>([])
  const [future, setFuture] = useState<Snapshot[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [showTable, setShowTable] = useState(true)

  const n = floor.length
  const selection = sel && sel.index < n ? sel : null
  const locks = locksOf(walls, n)
  const shown = preview ?? floor
  const liveBox = useMemo(() => bbox(floor), [floor])
  const box = frozenBox ?? liveBox
  const pad = Math.max(box.width, box.depth) * 0.22 + 0.7
  const vb = { x: box.minX - pad, y: box.minZ - pad, w: box.width + pad * 2, h: box.depth + pad * 2 }
  const unit = Math.max(vb.w, vb.h) / 60
  const previewError = preview ? (validateFloor(preview)[0] ?? lockViolation(floor, preview, locks)) : null

  const record = () => {
    setPast((p) => [...p.slice(-49), { floor, walls }])
    setFuture([])
  }
  const undo = () => {
    const prev = past[past.length - 1]
    if (!prev) return
    setPast(past.slice(0, -1))
    setFuture((f) => [...f, { floor, walls }])
    restoreLayout(prev.floor, prev.walls)
    setSel(null)
  }
  const redo = () => {
    const next = future[future.length - 1]
    if (!next) return
    setFuture(future.slice(0, -1))
    setPast((p) => [...p, { floor, walls }])
    restoreLayout(next.floor, next.walls)
    setSel(null)
  }
  const removeVertex = (i: number) => {
    if (n <= 3) return setNotice('至少要有 3 個轉角')
    const next = floor.filter((_, k) => k !== i)
    const err = validateFloor(next)[0]
    if (err) return setNotice(`無法刪除：${err}`)
    record()
    deleteVertex(i)
    setSel(null)
  }
  const addVertex = (i: number, t = 0.5) => {
    const len = wallSegment(floor, i).length
    if (len * t < 0.01 || len * (1 - t) < 0.01) return setNotice('牆太短，無法再分割')
    record()
    insertVertex(i, t)
    setSel({ kind: 'vertex', index: i + 1 })
  }
  const toggleLock = (i: number, key: 'lengthLocked' | 'angleLocked', v: boolean) => {
    record()
    setWallLock(i, key, v)
  }

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    keyRef.current = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selection?.kind === 'vertex') {
        e.preventDefault()
        removeVertex(selection.index)
      } else if (e.key === 'Escape') {
        setSel(null)
      }
    }
  })
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open])

  if (!open) return null

  const toWorld = (clientX: number, clientY: number): Vec2 | null => {
    const ctm = svgRef.current?.getScreenCTM()
    if (!ctm) return null
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
    return { x: pt.x, z: pt.y }
  }

  const beginDrag = (e: React.PointerEvent, d: Drag) => {
    e.stopPropagation()
    if (e.button !== 0) return
    svgRef.current?.setPointerCapture(e.pointerId)
    draggedRef.current = false
    setDrag(d)
    setSel({ kind: d.kind, index: d.index })
    setFrozenBox(liveBox)
    setNotice(null)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return
    const p = toWorld(e.clientX, e.clientY)
    if (!p) return
    if (drag.kind === 'vertex') {
      const c = constrainVertex(floor, drag.index, p, locks)
      if (!c) {
        setNotice('這個轉角周圍的數值都鎖住了，要移動請先解鎖')
        return
      }
      const q = { x: round2(Math.round(c.x / SNAP) * SNAP), z: round2(Math.round(c.z / SNAP) * SNAP) }
      const exact = constrainVertex(floor, drag.index, q, locks) ?? q
      const cur = floor[drag.index]
      if (Math.abs(exact.x - cur.x) < 1e-9 && Math.abs(exact.z - cur.z) < 1e-9 && !draggedRef.current) return
      const next = floor.map((v, i) => (i === drag.index ? { x: Math.round(exact.x * 10000) / 10000, z: Math.round(exact.z * 10000) / 10000 } : v))
      if (lockViolation(floor, next, locks)) return
      draggedRef.current = true
      setPreview(next)
    } else {
      const s = wallSegment(floor, drag.index)
      const raw = (p.x - drag.start.x) * s.normal.x + (p.z - drag.start.z) * s.normal.z
      const d = round2(Math.round(raw / SNAP) * SNAP)
      if (d === 0 && !draggedRef.current) return
      const next = d === 0 ? floor : moveWallParallel(floor, drag.index, d)
      const v = lockViolation(floor, next, locks)
      if (v) {
        setNotice(`${v}，這面牆不能平行移動`)
        return
      }
      draggedRef.current = true
      setMoveDist(d)
      setPreview(next)
    }
  }

  const endDrag = () => {
    if (!drag) return
    if (preview && !previewError && draggedRef.current && preview !== floor) {
      record()
      setFloor(preview)
    } else if (preview && previewError) {
      setNotice(`沒有套用：${previewError}`)
    }
    setPreview(null)
    setDrag(null)
    setFrozenBox(null)
    setMoveDist(0)
  }

  const check = (edit: FloorEdit) => {
    if (edit.kind === 'angle' && (edit.value <= 0 || edit.value >= 360)) return '角度需介於 0～360°'
    const r = solveFloor(floor, edit, locks)
    return 'error' in r ? r.error : null
  }
  const apply = (edit: FloorEdit) => {
    const r = solveFloor(floor, edit, locks)
    if ('floor' in r) {
      record()
      setFloor(r.floor)
    }
  }

  const gridLines: React.ReactNode[] = []
  for (let x = Math.floor(vb.x); x <= vb.x + vb.w; x += 0.5) {
    gridLines.push(<line key={`x${x}`} x1={x} y1={vb.y} x2={x} y2={vb.y + vb.h} stroke={Number.isInteger(x) ? '#cbd5e1' : '#e2e8f0'} strokeWidth={unit * 0.08} />)
  }
  for (let z = Math.floor(vb.y); z <= vb.y + vb.h; z += 0.5) {
    gridLines.push(<line key={`z${z}`} x1={vb.x} y1={z} x2={vb.x + vb.w} y2={z} stroke={Number.isInteger(z) ? '#cbd5e1' : '#e2e8f0'} strokeWidth={unit * 0.08} />)
  }

  const wallCursor = (i: number) => {
    const s = wallSegment(shown, i)
    if (Math.abs(s.dir.x) > 0.92) return 'ns-resize'
    if (Math.abs(s.dir.z) > 0.92) return 'ew-resize'
    return 'move'
  }

  const prevWall = (v: number) => (v - 1 + n) % n

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2 sm:p-6">
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-800">自訂格局（俯視圖）</h2>
            <p className="text-xs text-slate-500">拖曳牆面＝平行移動・拖曳轉角＝移動・雙擊牆面＝加轉折點・鎖住的數值不會被改動・橘色扇形為開門範圍・每格 0.5m</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={undo}
              disabled={past.length === 0}
              title="復原（Ctrl+Z）"
              className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-30"
            >
              ↶ 復原
            </button>
            <button
              onClick={redo}
              disabled={future.length === 0}
              title="重做（Ctrl+Y）"
              className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-30"
            >
              ↷
            </button>
            <button
              onClick={() => {
                setOpen(false)
                setSel(null)
                setPast([])
                setFuture([])
                setNotice(null)
              }}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              完成
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 bg-slate-50">
          <svg
            ref={svgRef}
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            className="h-[48vh] w-full touch-none select-none"
            style={{ cursor: drag?.kind === 'wall' ? wallCursor(drag.index) : drag ? 'grabbing' : undefined }}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClick={() => {
              if (draggedRef.current) {
                draggedRef.current = false
                return
              }
              setSel(null)
              setNotice(null)
            }}
          >
            {gridLines}
            <polygon
              points={shown.map((p) => `${p.x},${p.z}`).join(' ')}
              fill={previewError ? '#fee2e2' : '#e0f2fe'}
              stroke={previewError ? '#ef4444' : '#0f172a'}
              strokeWidth={unit * 0.35}
              strokeLinejoin="round"
              className="pointer-events-none"
            />

            {walls.slice(0, shown.length).flatMap((w, i) =>
              w.items
                .filter((it) => it.type === 'door' || it.type === 'window')
                .map((it) => {
                  const a = wallPoint(shown, i, it.offset)
                  const b = wallPoint(shown, i, it.offset + it.width)
                  if (it.type === 'window') {
                    const s = wallSegment(shown, i)
                    const o = unit * 0.35
                    return (
                      <g key={it.id} className="pointer-events-none">
                        <line x1={a.x} y1={a.z} x2={b.x} y2={b.z} stroke="#ffffff" strokeWidth={unit * 0.9} />
                        {[-1, 0, 1].map((k) => (
                          <line key={k} x1={a.x + s.normal.x * o * k} y1={a.z + s.normal.z * o * k} x2={b.x + s.normal.x * o * k} y2={b.z + s.normal.z * o * k} stroke="#0284c7" strokeWidth={unit * 0.14} />
                        ))}
                      </g>
                    )
                  }
                  const g = doorSwingGeometry(shown, i, it, 24)
                  const path = `M ${g.hinge.x} ${g.hinge.z} ` + g.arc.map((p) => `L ${p.x} ${p.z}`).join(' ') + ' Z'
                  const arcPath = `M ${g.arc[0].x} ${g.arc[0].z} ` + g.arc.slice(1).map((p) => `L ${p.x} ${p.z}`).join(' ')
                  return (
                    <g key={it.id} className="pointer-events-none">
                      <line x1={a.x} y1={a.z} x2={b.x} y2={b.z} stroke="#ffffff" strokeWidth={unit * 0.9} />
                      <path d={path} fill="#f59e0b" fillOpacity={g.swing.side === 'in' ? 0.12 : 0.05} />
                      <path d={arcPath} fill="none" stroke="#b45309" strokeWidth={unit * 0.12} strokeDasharray={`${unit * 0.5} ${unit * 0.3}`} />
                      <line x1={g.hinge.x} y1={g.hinge.z} x2={g.leafEnd.x} y2={g.leafEnd.z} stroke="#b45309" strokeWidth={unit * 0.3} strokeLinecap="round" />
                    </g>
                  )
                }),
            )}
            {shown.map((_, i) => {
              const deg = cornerAngle(shown, i)
              const locked = locks.angles[i]
              if (Math.abs(deg - 90) < 0.05) {
                const cur = shown[i]
                const a = wallSegment(shown, prevWall(i))
                const b = wallSegment(shown, i)
                const sz = unit * 1.6
                const p1 = { x: cur.x - a.dir.x * sz, z: cur.z - a.dir.z * sz }
                const p3 = { x: cur.x + b.dir.x * sz, z: cur.z + b.dir.z * sz }
                const p2 = { x: p1.x + b.dir.x * sz, z: p1.z + b.dir.z * sz }
                return (
                  <polyline
                    key={`a${i}`}
                    points={`${p1.x},${p1.z} ${p2.x},${p2.z} ${p3.x},${p3.z}`}
                    fill="none"
                    stroke={locked ? '#d97706' : '#94a3b8'}
                    strokeWidth={unit * (locked ? 0.3 : 0.2)}
                    className="pointer-events-none"
                  />
                )
              }
              const lp = cornerLabelPoint(shown, i, unit * 3.2)
              return (
                <text
                  key={`a${i}`}
                  x={lp.x}
                  y={lp.z}
                  fontSize={unit * 1.2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#b45309"
                  className="pointer-events-none font-semibold"
                >
                  {locked ? '🔒' : ''}
                  {formatAngle(deg)}
                </text>
              )
            })}

            {shown.map((_, i) => {
              const s = wallSegment(shown, i)
              const mx = s.a.x + (s.dir.x * s.length) / 2
              const mz = s.a.z + (s.dir.z * s.length) / 2
              const selected = selection?.kind === 'wall' && selection.index === i
              const dragging = drag?.kind === 'wall' && drag.index === i
              return (
                <g key={`w${i}`}>
                  <line
                    x1={s.a.x}
                    y1={s.a.z}
                    x2={s.b.x}
                    y2={s.b.z}
                    stroke={selected || dragging ? '#0284c7' : 'transparent'}
                    strokeWidth={unit * (selected || dragging ? 0.9 : 2.2)}
                    strokeLinecap="round"
                    className={selected || dragging ? '' : 'hover:stroke-sky-400/40'}
                    style={{ cursor: wallCursor(i) }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => {
                      const p = toWorld(e.clientX, e.clientY)
                      if (p) beginDrag(e, { kind: 'wall', index: i, start: p })
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      const p = toWorld(e.clientX, e.clientY)
                      if (!p) return
                      const t = Math.round((projectOnWall(floor, i, p) / s.length) * 100) / 100
                      addVertex(i, Math.min(Math.max(t, 0.01), 0.99))
                    }}
                  />
                  {(selected || dragging) && (
                    <line
                      x1={s.a.x}
                      y1={s.a.z}
                      x2={s.b.x}
                      y2={s.b.z}
                      stroke="transparent"
                      strokeWidth={unit * 2.2}
                      style={{ cursor: wallCursor(i) }}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => {
                        const p = toWorld(e.clientX, e.clientY)
                        if (p) beginDrag(e, { kind: 'wall', index: i, start: p })
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        const p = toWorld(e.clientX, e.clientY)
                        if (!p) return
                        const t = Math.round((projectOnWall(floor, i, p) / s.length) * 100) / 100
                        addVertex(i, Math.min(Math.max(t, 0.01), 0.99))
                      }}
                    />
                  )}
                  <text
                    x={mx - s.normal.x * unit * 2.6}
                    y={mz - s.normal.z * unit * 2.6}
                    fontSize={unit * 1.35}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="pointer-events-none"
                  >
                    <tspan fill={selected ? '#0284c7' : '#94a3b8'} fontSize={unit * 1.1}>
                      牆{i + 1}{' '}
                    </tspan>
                    <tspan fill={selected ? '#0284c7' : '#334155'} fontWeight={700}>
                      {locks.lengths[i] ? '🔒' : ''}
                      {s.length.toFixed(2)}m
                    </tspan>
                  </text>
                </g>
              )
            })}

            {shown.map((p, i) => {
              const selected = selection?.kind === 'vertex' && selection.index === i
              const dragging = drag?.kind === 'vertex' && drag.index === i
              return (
                <circle
                  key={`v${i}`}
                  cx={p.x}
                  cy={p.z}
                  r={unit * (dragging ? 1.25 : 1)}
                  fill={selected ? '#f59e0b' : '#ffffff'}
                  stroke="#0f172a"
                  strokeWidth={unit * 0.28}
                  className="cursor-grab active:cursor-grabbing"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => beginDrag(e, { kind: 'vertex', index: i })}
                />
              )
            })}
          </svg>

          {drag && preview && (
            <div
              className={`pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow ${
                previewError ? 'bg-red-500' : 'bg-slate-800'
              }`}
            >
              {previewError
                ? `${previewError}（放開後不會套用）`
                : drag.kind === 'wall'
                  ? `牆 ${drag.index + 1} 平行移動 ${moveDist > 0 ? '+' : ''}${moveDist.toFixed(2)}m`
                  : `移動轉角`}
            </div>
          )}
          {notice && !(drag && preview) && (
            <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow">{notice}</div>
          )}
        </div>

        <div className="flex min-h-[60px] flex-wrap items-end gap-3 border-t border-slate-100 px-4 py-3">
          {!selection && <span className="self-center text-xs text-slate-400">點一面牆或一個轉角來編輯。修改格局後，被分割或合併的牆需要重新拍照確認。</span>}
          {selection?.kind === 'wall' && (
            <>
              <span className="self-center text-sm font-bold text-sky-700">牆 {selection.index + 1}</span>
              <div className="flex items-end gap-1">
                <div className="w-28">
                  <NumberField
                    key={`wl${selection.index}-${n}`}
                    compact
                    label="長度"
                    disabled={locks.lengths[selection.index]}
                    value={wallSegment(floor, selection.index).length}
                    validate={(v) => check({ kind: 'length', index: selection.index, value: v })}
                    onCommit={(v) => apply({ kind: 'length', index: selection.index, value: v })}
                  />
                </div>
                <LockButton locked={locks.lengths[selection.index]} onToggle={() => toggleLock(selection.index, 'lengthLocked', !locks.lengths[selection.index])} />
              </div>
              <button
                onClick={() => addVertex(selection.index)}
                className="rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50"
              >
                ＋ 在中間加轉折點
              </button>
              <span className="self-center text-[11px] text-slate-400">直接拖曳這面牆可以平行移動</span>
            </>
          )}
          {selection?.kind === 'vertex' && (
            <>
              <span className="self-center text-sm font-bold text-amber-600">
                轉角（牆 {prevWall(selection.index) + 1}／牆 {selection.index + 1}）
              </span>
              <div className="flex items-end gap-1">
                <div className="w-28">
                  <NumberField
                    key={`va${selection.index}-${n}`}
                    compact
                    label="角度"
                    suffix="°"
                    step={1}
                    digits={1}
                    disabled={locks.angles[selection.index]}
                    value={cornerAngle(floor, selection.index)}
                    validate={(v) => check({ kind: 'angle', index: selection.index, value: v })}
                    onCommit={(v) => apply({ kind: 'angle', index: selection.index, value: v })}
                  />
                </div>
                <LockButton locked={locks.angles[selection.index]} onToggle={() => toggleLock(selection.index, 'angleLocked', !locks.angles[selection.index])} />
              </div>
              <button
                disabled={n <= 3}
                onClick={() => removeVertex(selection.index)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                刪除轉角
              </button>
            </>
          )}
        </div>

        <div className="border-t border-slate-100">
          <div className="flex items-center justify-between px-4 py-2">
            <button onClick={() => setShowTable((v) => !v)} className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
              <span className={`inline-block transition-transform ${showTable ? 'rotate-90' : ''}`}>▸</span>
              全部尺寸與角度
            </button>
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  record()
                  setAllLocks(true)
                }}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                🔒 全部鎖定
              </button>
              <button
                onClick={() => {
                  record()
                  setAllLocks(false)
                }}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                🔓 全部解鎖
              </button>
            </div>
          </div>
          {showTable && (
            <div className="max-h-[26vh] overflow-y-auto px-4 pb-3">
              <p className="mb-2 text-[11px] text-slate-400">量好的數值按 🔒 鎖住；之後修改或拖曳時，鎖住的長度和角度都不會被改到。</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {floor.map((_, i) => {
                  const j = (i + 1) % n
                  const active = selection?.kind === 'wall' && selection.index === i
                  return (
                    <div
                      key={`q${i}-${n}`}
                      onClick={() => setSel({ kind: 'wall', index: i })}
                      className={`grid grid-cols-[3rem_1fr_1fr] items-center gap-2 rounded-lg border px-2 py-1.5 ${
                        active ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <span className="text-sm font-semibold text-slate-700">牆 {i + 1}</span>
                      <div className="flex items-end gap-1">
                        <div className="min-w-0 flex-1">
                          <NumberField
                            compact
                            label="長度"
                            disabled={locks.lengths[i]}
                            value={wallSegment(floor, i).length}
                            validate={(v) => check({ kind: 'length', index: i, value: v })}
                            onCommit={(v) => apply({ kind: 'length', index: i, value: v })}
                          />
                        </div>
                        <LockButton locked={locks.lengths[i]} onToggle={() => toggleLock(i, 'lengthLocked', !locks.lengths[i])} />
                      </div>
                      <div className="flex items-end gap-1">
                        <div className="min-w-0 flex-1">
                          <NumberField
                            compact
                            label={`與牆 ${j + 1} 夾角`}
                            suffix="°"
                            step={1}
                            digits={1}
                            disabled={locks.angles[j]}
                            value={cornerAngle(floor, j)}
                            validate={(v) => check({ kind: 'angle', index: j, value: v })}
                            onCommit={(v) => apply({ kind: 'angle', index: j, value: v })}
                          />
                        </div>
                        <LockButton locked={locks.angles[j]} onToggle={() => toggleLock(j, 'angleLocked', !locks.angles[j])} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LockButton({ locked, onToggle }: { locked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      title={locked ? '已鎖定，點擊解鎖' : '點擊鎖定'}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={`flex h-[30px] w-7 shrink-0 items-center justify-center rounded-lg border text-sm ${
        locked ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white opacity-50 hover:opacity-100'
      }`}
    >
      {locked ? '🔒' : '🔓'}
    </button>
  )
}
