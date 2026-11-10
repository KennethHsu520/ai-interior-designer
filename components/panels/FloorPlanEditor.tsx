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
import { ChevronRight, Lock, LockOpen, Plus, Redo2, Undo2 } from 'lucide-react'
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
  const backgroundDownRef = useRef(false)
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
    backgroundDownRef.current = false
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
    gridLines.push(<line key={`x${x}`} x1={x} y1={vb.y} x2={x} y2={vb.y + vb.h} stroke={Number.isInteger(x) ? '#d6d3cd' : '#e5e3df'} strokeWidth={unit * 0.08} />)
  }
  for (let z = Math.floor(vb.y); z <= vb.y + vb.h; z += 0.5) {
    gridLines.push(<line key={`z${z}`} x1={vb.x} y1={z} x2={vb.x + vb.w} y2={z} stroke={Number.isInteger(z) ? '#d6d3cd' : '#e5e3df'} strokeWidth={unit * 0.08} />)
  }

  const wallCursor = (i: number) => {
    const s = wallSegment(shown, i)
    if (Math.abs(s.dir.x) > 0.92) return 'ns-resize'
    if (Math.abs(s.dir.z) > 0.92) return 'ew-resize'
    return 'move'
  }

  const prevWall = (v: number) => (v - 1 + n) % n

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-2 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-hero bg-white shadow-float">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-ink">自訂格局（俯視圖）</h2>
            <p className="text-xs text-ink-3">拖曳牆面＝平行移動・拖曳轉角＝移動・雙擊牆面＝加轉折點・鎖住的數值不會被改動・橘色扇形為開門範圍・每格 0.5m</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={undo}
              disabled={past.length === 0}
              title="復原（Ctrl+Z）"
              className="inline-flex h-9 items-center gap-1 rounded-pill border border-line bg-white px-3 text-xs font-medium text-ink-2 transition-colors duration-200 ease-soft hover:bg-surface disabled:opacity-30"
            >
              <Undo2 size={14} strokeWidth={1.75} />
              復原
            </button>
            <button
              onClick={redo}
              disabled={future.length === 0}
              title="重做（Ctrl+Y）"
              className="inline-flex h-9 w-9 items-center justify-center rounded-pill border border-line bg-white text-ink-2 transition-colors duration-200 ease-soft hover:bg-surface disabled:opacity-30"
            >
              <Redo2 size={14} strokeWidth={1.75} />
            </button>
            <button
              onClick={() => {
                setOpen(false)
                setSel(null)
                setPast([])
                setFuture([])
                setNotice(null)
              }}
              className="inline-flex h-9 items-center rounded-pill bg-brand-500 px-4 text-sm font-medium text-white shadow-hairline transition-colors duration-200 ease-soft hover:bg-brand-600"
            >
              完成
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 bg-surface">
          <svg
            ref={svgRef}
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            className="h-[48vh] w-full touch-none select-none"
            style={{ cursor: drag?.kind === 'wall' ? wallCursor(drag.index) : drag ? 'grabbing' : undefined }}
            onPointerDown={(e) => {
              backgroundDownRef.current = e.button === 0
            }}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClick={() => {
              const fromBackground = backgroundDownRef.current
              backgroundDownRef.current = false
              if (draggedRef.current) {
                draggedRef.current = false
                return
              }
              if (!fromBackground) return
              setSel(null)
              setNotice(null)
            }}
          >
            {gridLines}
            <polygon
              points={shown.map((p) => `${p.x},${p.z}`).join(' ')}
              fill={previewError ? '#f7e3da' : '#faf4f0'}
              stroke={previewError ? '#c2410c' : '#1d1d1f'}
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
                          <line key={k} x1={a.x + s.normal.x * o * k} y1={a.z + s.normal.z * o * k} x2={b.x + s.normal.x * o * k} y2={b.z + s.normal.z * o * k} stroke="#a65a3a" strokeWidth={unit * 0.14} />
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
                      <path d={path} fill="#c4815f" fillOpacity={g.swing.side === 'in' ? 0.12 : 0.05} />
                      <path d={arcPath} fill="none" stroke="#8e4c31" strokeWidth={unit * 0.12} strokeDasharray={`${unit * 0.5} ${unit * 0.3}`} />
                      <line x1={g.hinge.x} y1={g.hinge.z} x2={g.leafEnd.x} y2={g.leafEnd.z} stroke="#8e4c31" strokeWidth={unit * 0.3} strokeLinecap="round" />
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
                    stroke={locked ? '#a65a3a' : '#a1a1a6'}
                    strokeWidth={unit * (locked ? 0.3 : 0.2)}
                    className="pointer-events-none"
                  />
                )
              }
              const lp = cornerLabelPoint(shown, i, unit * 3.2)
              return (
                <g key={`a${i}`}>
                  {locked && <LockGlyph x={lp.x} y={lp.z - unit * 1.35} s={unit * 1.1} />}
                <text
                  x={lp.x}
                  y={lp.z}
                  fontSize={unit * 1.2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#8e4c31"
                  className="pointer-events-none font-medium"
                >
                  {formatAngle(deg)}
                </text>
                </g>
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
                    stroke={selected || dragging ? '#a65a3a' : 'transparent'}
                    strokeWidth={unit * (selected || dragging ? 0.9 : 2.2)}
                    strokeLinecap="round"
                    className={selected || dragging ? '' : 'hover:stroke-brand-400/40'}
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
                  {locks.lengths[i] && <LockGlyph x={mx - s.normal.x * unit * 2.6} y={mz - s.normal.z * unit * 2.6 - unit * 1.5} s={unit * 1.1} />}

                  <text
                    x={mx - s.normal.x * unit * 2.6}
                    y={mz - s.normal.z * unit * 2.6}
                    fontSize={unit * 1.35}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="pointer-events-none"
                  >
                    <tspan fill={selected ? '#a65a3a' : '#a1a1a6'} fontSize={unit * 1.1}>
                      牆{i + 1}{' '}
                    </tspan>
                    <tspan fill={selected ? '#a65a3a' : '#424245'} fontWeight={700}>
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
                  fill={selected ? '#c4815f' : '#ffffff'}
                  stroke="#1d1d1f"
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
              className={`pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-pill px-3.5 py-1.5 text-xs font-medium text-white shadow-float ${
                previewError ? 'bg-danger' : 'bg-ink'
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
            <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-pill bg-brand-500 px-3.5 py-1.5 text-xs font-medium text-white shadow-float">{notice}</div>
          )}
        </div>

        <div className="flex min-h-[60px] flex-wrap items-end gap-3 border-t border-line px-4 py-3">
          {!selection && <span className="self-center text-xs text-ink-4">點一面牆或一個轉角來編輯。修改格局後，被分割或合併的牆需要重新拍照確認。</span>}
          {selection?.kind === 'wall' && (
            <>
              <span className="self-center text-sm font-bold text-brand-700">牆 {selection.index + 1}</span>
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
                className="inline-flex h-8 items-center gap-1 rounded-pill border border-brand-200 bg-white px-3 text-xs font-medium text-brand-700 transition-colors duration-200 ease-soft hover:bg-brand-50"
              >
                <Plus size={13} strokeWidth={2} />
                在中間加轉折點
              </button>
              <span className="self-center text-[11px] text-ink-4">直接拖曳這面牆可以平行移動</span>
            </>
          )}
          {selection?.kind === 'vertex' && (
            <>
              <span className="self-center text-sm font-bold text-brand-700">
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
                className="inline-flex h-8 items-center rounded-pill border border-danger/40 bg-white px-3 text-xs font-medium text-danger transition-colors duration-200 ease-soft hover:bg-danger/10 disabled:opacity-40"
              >
                刪除轉角
              </button>
            </>
          )}
        </div>

        <div className="border-t border-line">
          <div className="flex items-center justify-between px-4 py-2">
            <button onClick={() => setShowTable((v) => !v)} className="flex items-center gap-1.5 text-sm font-bold text-ink">
              <ChevronRight size={16} strokeWidth={1.75} className={`transition-transform duration-200 ease-soft ${showTable ? 'rotate-90' : ''}`} />
              全部尺寸與角度
            </button>
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  record()
                  setAllLocks(true)
                }}
                className="inline-flex h-8 items-center gap-1 rounded-pill border border-line bg-white px-3 text-xs font-medium text-ink-2 transition-colors duration-200 ease-soft hover:bg-surface"
              >
                <Lock size={12} strokeWidth={1.75} />
                全部鎖定
              </button>
              <button
                onClick={() => {
                  record()
                  setAllLocks(false)
                }}
                className="inline-flex h-8 items-center gap-1 rounded-pill border border-line bg-white px-3 text-xs font-medium text-ink-2 transition-colors duration-200 ease-soft hover:bg-surface"
              >
                <LockOpen size={12} strokeWidth={1.75} />
                全部解鎖
              </button>
            </div>
          </div>
          {showTable && (
            <div className="max-h-[26vh] overflow-y-auto px-4 pb-3">
              <p className="mb-2 text-[11px] text-ink-4">量好的數值按鎖頭鎖住；之後修改或拖曳時，鎖住的長度和角度都不會被改到。</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {floor.map((_, i) => {
                  const j = (i + 1) % n
                  const active = selection?.kind === 'wall' && selection.index === i
                  return (
                    <div
                      key={`q${i}-${n}`}
                      onClick={() => setSel({ kind: 'wall', index: i })}
                      className={`grid grid-cols-[3rem_1fr_1fr] items-center gap-2 rounded-field border px-2 py-1.5 ${
                        active ? 'border-brand-400 bg-brand-50' : 'border-line bg-white'
                      }`}
                    >
                      <span className="text-sm font-medium text-ink-2">牆 {i + 1}</span>
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
      className={`flex h-[30px] w-7 shrink-0 items-center justify-center rounded-field border transition-colors duration-200 ease-soft ${
        locked ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-4 hover:text-ink'
      }`}
    >
      {locked ? <Lock size={13} strokeWidth={1.75} /> : <LockOpen size={13} strokeWidth={1.75} />}
    </button>
  )
}

function LockGlyph({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x - s / 2} ${y - s / 2}) scale(${s / 24})`} fill="none" stroke="#8e4c31" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </g>
  )
}
