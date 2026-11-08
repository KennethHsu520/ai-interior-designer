'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { useRoomStore } from '@/store/useRoomStore'
import { bbox, clampItem, uid, wallPoint } from '@/lib/geometry'
import { itemTypeInfo, WALL_ITEM_TYPES, type PhotoBounds, type WallItem, type WallItemType } from '@/types/room'

type Rect = { x0: number; x1: number; y0: number; y1: number }
type Pt = { x: number; y: number }
type Corner = 'nw' | 'ne' | 'sw' | 'se'
type Guide = 'x0' | 'x1' | 'y0' | 'y1'

type Op =
  | { kind: 'draw'; start: Pt; rect: Rect }
  | { kind: 'item'; id: string; mode: 'move' | Corner; start: Pt; rect: Rect }
  | { kind: 'guide'; key: Guide }
  | { kind: 'pan'; x: number; y: number; left: number; top: number }

type Pinch = { dist: number; zoom: number; content: Pt }

const FULL: PhotoBounds = { x0: 0, x1: 1, y0: 0, y1: 1 }
const FIRST_GUESS: PhotoBounds = { x0: 0.06, x1: 0.94, y0: 0.08, y1: 0.92 }
const MIN_ZOOM = 1
const MAX_ZOOM = 5
const MIN_GAP = 0.05
const MIN_BOX = 0.006
const CEILING_TYPES: WallItemType[] = ['light', 'air_conditioner']

const GUIDES: { key: Guide; label: string }[] = [
  { key: 'x0', label: '左牆角' },
  { key: 'x1', label: '右牆角' },
  { key: 'y0', label: '天花板交界' },
  { key: 'y1', label: '地板交界' },
]

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const round2 = (v: number) => Math.round(v * 100) / 100

function normRect(a: Pt, b: Pt): Rect {
  return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) }
}

export default function PhotoMarker({
  wallIndex,
  wallId,
  length,
  height,
  items,
  photo,
  bounds,
}: {
  wallIndex: number
  wallId: string
  length: number
  height: number
  items: WallItem[]
  photo: string
  bounds?: PhotoBounds
}) {
  const floor = useRoomStore((s) => s.room.floor)
  const ceilingItems = useRoomStore((s) => s.room.ceilingItems)
  const selectedItemId = useRoomStore((s) => s.selectedItemId)
  const selectItem = useRoomStore((s) => s.selectItem)
  const addItem = useRoomStore((s) => s.addItem)
  const updateItem = useRoomStore((s) => s.updateItem)
  const removeItem = useRoomStore((s) => s.removeItem)
  const setPhotoBounds = useRoomStore((s) => s.setPhotoBounds)
  const addCeilingItem = useRoomStore((s) => s.addCeilingItem)
  const removeCeilingItem = useRoomStore((s) => s.removeCeilingItem)

  const viewportRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, Pt>())
  const pending = useRef<Op | null>(null)
  const pinch = useRef<Pinch | null>(null)
  const scrollTarget = useRef<Pt | null>(null)

  const [mode, setMode] = useState<'bounds' | 'draw'>(bounds ? 'draw' : 'bounds')
  const [tool, setTool] = useState<WallItemType>('door')
  const [onCeiling, setOnCeiling] = useState(false)
  const [hand, setHand] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [aspect, setAspect] = useState(4 / 3)
  const [op, setOp] = useState<Op | null>(null)
  const [draftBounds, setDraftBounds] = useState<PhotoBounds | null>(null)

  const b = draftBounds ?? bounds ?? FIRST_GUESS
  const bw = Math.max(1e-6, b.x1 - b.x0)
  const bh = Math.max(1e-6, b.y1 - b.y0)
  const ceilingMode = onCeiling && CEILING_TYPES.includes(tool)
  const wallCeiling = ceilingItems.filter((c) => c.sourceWallId === wallId)

  useLayoutEffect(() => {
    const vp = viewportRef.current
    const t = scrollTarget.current
    if (!vp || !t) return
    vp.scrollLeft = t.x
    vp.scrollTop = t.y
    scrollTarget.current = null
  }, [zoom])

  const toPhoto = (clientX: number, clientY: number): Pt => {
    const r = surfaceRef.current!.getBoundingClientRect()
    return { x: clamp01((clientX - r.left) / r.width), y: clamp01((clientY - r.top) / r.height) }
  }

  const itemToRect = (it: WallItem): Rect => ({
    x0: b.x0 + (it.offset / length) * bw,
    x1: b.x0 + ((it.offset + it.width) / length) * bw,
    y0: b.y0 + (1 - (it.elevation + it.height) / height) * bh,
    y1: b.y0 + (1 - it.elevation / height) * bh,
  })

  const rectToMeters = (r: Rect) => {
    const rx0 = (r.x0 - b.x0) / bw
    const rx1 = (r.x1 - b.x0) / bw
    const ry0 = (r.y0 - b.y0) / bh
    const ry1 = (r.y1 - b.y0) / bh
    return {
      offset: round2(rx0 * length),
      width: round2(Math.max(0.02, (rx1 - rx0) * length)),
      elevation: round2((1 - ry1) * height),
      height: round2(Math.max(0.02, (ry1 - ry0) * height)),
    }
  }

  const zoomTo = (next: number, anchorClient?: Pt) => {
    const vp = viewportRef.current
    if (!vp) return
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
    const vr = vp.getBoundingClientRect()
    const ax = anchorClient ? anchorClient.x - vr.left : vr.width / 2
    const ay = anchorClient ? anchorClient.y - vr.top : vr.height / 2
    const cx = (vp.scrollLeft + ax) / zoom
    const cy = (vp.scrollTop + ay) / zoom
    scrollTarget.current = { x: cx * z - ax, y: cy * z - ay }
    setZoom(z)
  }

  const commitBounds = (next: PhotoBounds) => {
    const r3 = (v: number) => Math.round(v * 1000) / 1000
    setPhotoBounds(wallIndex, { x0: r3(next.x0), x1: r3(next.x1), y0: r3(next.y0), y1: r3(next.y1) })
  }

  const finishDraw = (rect: Rect) => {
    if (rect.x1 - rect.x0 < MIN_BOX || rect.y1 - rect.y0 < MIN_BOX) {
      selectItem(null)
      return
    }
    const info = itemTypeInfo(tool)
    const m = rectToMeters(rect)
    if (ceilingMode) {
      const b2 = bbox(floor)
      const inset = Math.min(1.2, Math.min(b2.width, b2.depth) / 2)
      const p = wallPoint(floor, wallIndex, m.offset + m.width / 2, inset)
      addCeilingItem({
        id: uid('ceil'),
        type: tool,
        label: info.label,
        x: round2(p.x),
        z: round2(p.z),
        width: Math.max(0.2, m.width),
        depth: Math.max(0.2, round2(m.width * 0.5)),
        confirmed: true,
        sourceWallId: wallId,
      })
      return
    }
    const item = clampItem({ id: uid('item'), type: tool, label: info.label, ...m, confirmed: true }, length, height)
    addItem(wallIndex, item)
    selectItem(item.id)
  }

  const applyItemOp = (o: Extract<Op, { kind: 'item' }>, p: Pt) => {
    const dx = p.x - o.start.x
    const dy = p.y - o.start.y
    const r = o.rect
    let next: Rect
    if (o.mode === 'move') next = { x0: r.x0 + dx, x1: r.x1 + dx, y0: r.y0 + dy, y1: r.y1 + dy }
    else {
      const a = { x: o.mode === 'nw' || o.mode === 'sw' ? r.x0 + dx : r.x0, y: o.mode === 'nw' || o.mode === 'ne' ? r.y0 + dy : r.y0 }
      const c = { x: o.mode === 'ne' || o.mode === 'se' ? r.x1 + dx : r.x1, y: o.mode === 'sw' || o.mode === 'se' ? r.y1 + dy : r.y1 }
      next = normRect(a, c)
      if (next.x1 - next.x0 < MIN_BOX) next.x1 = next.x0 + MIN_BOX
      if (next.y1 - next.y0 < MIN_BOX) next.y1 = next.y0 + MIN_BOX
    }
    const current = items.find((it) => it.id === o.id)
    if (!current) return
    const m = clampItem({ ...current, ...rectToMeters(next) }, length, height)
    updateItem(wallIndex, o.id, { offset: m.offset, width: m.width, elevation: m.elevation, height: m.height })
  }

  const applyGuide = (key: Guide, p: Pt) => {
    const cur = draftBounds ?? bounds ?? FIRST_GUESS
    const next = { ...cur }
    if (key === 'x0') next.x0 = Math.min(p.x, cur.x1 - MIN_GAP)
    if (key === 'x1') next.x1 = Math.max(p.x, cur.x0 + MIN_GAP)
    if (key === 'y0') next.y0 = Math.min(p.y, cur.y1 - MIN_GAP)
    if (key === 'y1') next.y1 = Math.max(p.y, cur.y0 + MIN_GAP)
    setDraftBounds(next)
  }

  const startPinch = () => {
    const vp = viewportRef.current
    const [a, c] = [...pointers.current.values()]
    if (!vp || !a || !c) return
    const vr = vp.getBoundingClientRect()
    const mid = { x: (a.x + c.x) / 2 - vr.left, y: (a.y + c.y) / 2 - vr.top }
    pinch.current = {
      dist: Math.hypot(a.x - c.x, a.y - c.y) || 1,
      zoom,
      content: { x: (vp.scrollLeft + mid.x) / zoom, y: (vp.scrollTop + mid.y) / zoom },
    }
  }

  const endOp = (o: Op | null) => {
    if (!o) return
    if (o.kind === 'draw') finishDraw(o.rect)
    if (o.kind === 'guide' && draftBounds) {
      commitBounds(draftBounds)
      setDraftBounds(null)
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    try {
      surfaceRef.current?.setPointerCapture(e.pointerId)
    } catch {}
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const queued = pending.current
    pending.current = null
    if (pointers.current.size >= 2) {
      if (op?.kind === 'guide') setDraftBounds(null)
      setOp(null)
      startPinch()
      return
    }
    const vp = viewportRef.current
    if (hand && vp) {
      setOp({ kind: 'pan', x: e.clientX, y: e.clientY, left: vp.scrollLeft, top: vp.scrollTop })
      return
    }
    if (queued) {
      setOp(queued)
      return
    }
    if (mode === 'draw') {
      const p = toPhoto(e.clientX, e.clientY)
      setOp({ kind: 'draw', start: p, rect: { x0: p.x, x1: p.x, y0: p.y, y1: p.y } })
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pz = pinch.current
    const vp = viewportRef.current
    if (pz && vp && pointers.current.size >= 2) {
      const [a, c] = [...pointers.current.values()]
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pz.zoom * (Math.hypot(a.x - c.x, a.y - c.y) / pz.dist)))
      const vr = vp.getBoundingClientRect()
      const mid = { x: (a.x + c.x) / 2 - vr.left, y: (a.y + c.y) / 2 - vr.top }
      scrollTarget.current = { x: pz.content.x * z - mid.x, y: pz.content.y * z - mid.y }
      if (z === zoom) {
        vp.scrollLeft = scrollTarget.current.x
        vp.scrollTop = scrollTarget.current.y
        scrollTarget.current = null
      } else setZoom(z)
      return
    }
    if (!op) return
    if (op.kind === 'pan' && vp) {
      vp.scrollLeft = op.left - (e.clientX - op.x)
      vp.scrollTop = op.top - (e.clientY - op.y)
      return
    }
    const p = toPhoto(e.clientX, e.clientY)
    if (op.kind === 'draw') setOp({ ...op, rect: normRect(op.start, p) })
    else if (op.kind === 'item') applyItemOp(op, p)
    else if (op.kind === 'guide') applyGuide(op.key, p)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pinch.current) {
      if (pointers.current.size === 0) pinch.current = null
      return
    }
    endOp(op)
    setOp(null)
  }

  const onPointerCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) pinch.current = null
    if (op?.kind === 'guide') setDraftBounds(null)
    setOp(null)
  }

  const queueItem = (it: WallItem, m: 'move' | Corner) => (e: React.PointerEvent) => {
    if (mode !== 'draw' || hand) return
    selectItem(it.id)
    pending.current = { kind: 'item', id: it.id, mode: m, start: toPhoto(e.clientX, e.clientY), rect: itemToRect(it) }
  }

  const queueGuide = (key: Guide) => () => {
    if (mode !== 'bounds' || hand) return
    pending.current = { kind: 'guide', key }
  }

  const selected = items.find((it) => it.id === selectedItemId)
  const tabBtn = (active: boolean) =>
    `flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`
  const ctrlBtn = 'flex h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        <button className={tabBtn(mode === 'bounds')} onClick={() => setMode('bounds')}>
          ① 標出牆角{bounds ? ' ✓' : ''}
        </button>
        <button className={tabBtn(mode === 'draw')} onClick={() => setMode('draw')}>
          ② 框選物件
        </button>
      </div>

      {mode === 'bounds' ? (
        <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-800">
          拖曳四條黃色線，對齊照片中這面牆的<b>左右牆角</b>、<b>天花板交界</b>和<b>地板交界</b>。物件的位置會依照這四條線換算成公尺。
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-4 gap-1">
            {WALL_ITEM_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTool(t.value)}
                className={`flex items-center justify-center gap-1 rounded-md border px-1 py-1.5 text-[11px] font-semibold ${
                  tool === t.value ? 'border-transparent text-white shadow' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
                style={tool === t.value ? { background: t.color } : undefined}
              >
                {tool !== t.value && <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: t.color }} />}
                {t.label}
              </button>
            ))}
          </div>
          {CEILING_TYPES.includes(tool) && (
            <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <input type="checkbox" checked={onCeiling} onChange={(e) => setOnCeiling(e.target.checked)} className="accent-sky-600" />
              這是天花板上的{itemTypeInfo(tool).label}（不是裝在牆上）
            </label>
          )}
          <p className="text-[11px] text-slate-500">
            在照片上拖曳畫框新增「{itemTypeInfo(tool).label}」{ceilingMode ? '（天花板）' : ''}。點框可以選取，拖曳移動，拉四個角改大小。
          </p>
        </div>
      )}

      <div className="flex items-center gap-1">
        <button className={ctrlBtn} onClick={() => zoomTo(zoom / 1.5)} disabled={zoom <= MIN_ZOOM} aria-label="縮小">
          －
        </button>
        <span className="w-12 text-center text-xs tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span>
        <button className={ctrlBtn} onClick={() => zoomTo(zoom * 1.5)} disabled={zoom >= MAX_ZOOM} aria-label="放大">
          ＋
        </button>
        <button
          className={`${ctrlBtn} ${hand ? 'border-sky-400 bg-sky-50 text-sky-700' : ''}`}
          onClick={() => setHand((h) => !h)}
          aria-pressed={hand}
          title="移動畫面"
        >
          ✋ 移動畫面
        </button>
        <span className="ml-auto hidden text-[10px] text-slate-400 sm:block">手機可用雙指縮放</span>
      </div>

      <div ref={viewportRef} className="relative max-h-[65vh] touch-none overflow-auto overscroll-contain rounded-lg border border-slate-300 bg-slate-800">
        <div
          ref={surfaceRef}
          className={`relative overflow-hidden select-none ${hand ? 'cursor-grab' : mode === 'draw' ? 'cursor-crosshair' : ''}`}
          style={{ width: `${zoom * 100}%`, aspectRatio: aspect }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <img
            src={photo}
            alt="牆面照片"
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget
              if (img.naturalWidth && img.naturalHeight) setAspect(img.naturalWidth / img.naturalHeight)
            }}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />

          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-0 bg-black/45" style={{ height: `${b.y0 * 100}%` }} />
            <div className="absolute inset-x-0 bottom-0 bg-black/45" style={{ height: `${(1 - b.y1) * 100}%` }} />
            <div className="absolute left-0 bg-black/45" style={{ top: `${b.y0 * 100}%`, height: `${bh * 100}%`, width: `${b.x0 * 100}%` }} />
            <div className="absolute right-0 bg-black/45" style={{ top: `${b.y0 * 100}%`, height: `${bh * 100}%`, width: `${(1 - b.x1) * 100}%` }} />
          </div>

          {items.map((it) => {
            const r = itemToRect(it)
            const info = itemTypeInfo(it.type)
            const sel = it.id === selectedItemId
            const interactive = mode === 'draw' && !hand
            return (
              <div
                key={it.id}
                onPointerDown={queueItem(it, 'move')}
                className={`absolute rounded-sm border-2 ${interactive ? 'cursor-move' : 'pointer-events-none'} ${sel ? 'z-10 ring-2 ring-amber-300' : ''}`}
                style={{
                  left: `${r.x0 * 100}%`,
                  top: `${r.y0 * 100}%`,
                  width: `${(r.x1 - r.x0) * 100}%`,
                  height: `${(r.y1 - r.y0) * 100}%`,
                  borderColor: info.color,
                  background: `${info.color}40`,
                  minWidth: 8,
                  minHeight: 8,
                }}
              >
                <span className="pointer-events-none absolute -top-4 left-0 whitespace-nowrap rounded px-1 text-[9px] font-semibold leading-4 text-white" style={{ background: info.color }}>
                  {info.label}
                </span>
                {sel &&
                  interactive &&
                  (['nw', 'ne', 'sw', 'se'] as Corner[]).map((c) => (
                    <span
                      key={c}
                      onPointerDown={queueItem(it, c)}
                      className="absolute h-4 w-4 rounded-full border-2 border-white bg-amber-500 shadow"
                      style={{
                        left: c === 'nw' || c === 'sw' ? -8 : undefined,
                        right: c === 'ne' || c === 'se' ? -8 : undefined,
                        top: c === 'nw' || c === 'ne' ? -8 : undefined,
                        bottom: c === 'sw' || c === 'se' ? -8 : undefined,
                        cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize',
                      }}
                    />
                  ))}
              </div>
            )
          })}

          {op?.kind === 'draw' && (
            <div
              className="pointer-events-none absolute border-2 border-dashed"
              style={{
                left: `${op.rect.x0 * 100}%`,
                top: `${op.rect.y0 * 100}%`,
                width: `${(op.rect.x1 - op.rect.x0) * 100}%`,
                height: `${(op.rect.y1 - op.rect.y0) * 100}%`,
                borderColor: itemTypeInfo(tool).color,
                background: `${itemTypeInfo(tool).color}33`,
              }}
            />
          )}

          {GUIDES.map((g) => {
            const vertical = g.key === 'x0' || g.key === 'x1'
            const pos = b[g.key] * 100
            const active = mode === 'bounds' && !hand
            return (
              <div
                key={g.key}
                onPointerDown={queueGuide(g.key)}
                className={`absolute z-20 flex items-center justify-center ${active ? '' : 'pointer-events-none'}`}
                style={
                  vertical
                    ? { left: `${pos}%`, top: 0, bottom: 0, width: 28, marginLeft: -14, cursor: active ? 'ew-resize' : undefined }
                    : { top: `${pos}%`, left: 0, right: 0, height: 28, marginTop: -14, cursor: active ? 'ns-resize' : undefined }
                }
              >
                <div className={`${vertical ? 'h-full w-0.5' : 'h-0.5 w-full'} ${active ? 'bg-amber-400' : 'bg-amber-400/50'}`} />
                {active && (
                  <span
                    className="absolute whitespace-nowrap rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950 shadow"
                    style={
                      vertical
                        ? { top: g.key === 'x0' ? '30%' : '60%', ...(g.key === 'x0' ? { left: 16 } : { right: 16 }) }
                        : { left: g.key === 'y0' ? '30%' : '55%', ...(g.key === 'y0' ? { top: 16 } : { bottom: 16 }) }
                    }
                  >
                    {g.label}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {mode === 'bounds' && (
        <div className="flex gap-2">
          <button
            onClick={() => {
              commitBounds(FULL)
            }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            重設為整張照片
          </button>
          <button
            onClick={() => {
              if (!bounds) commitBounds(b)
              setMode('draw')
            }}
            className="flex-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-500"
          >
            牆角標好了，開始框選物件 →
          </button>
        </div>
      )}

      {mode === 'draw' && selected && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs">
          <span className="font-semibold text-amber-800">已選取</span>
          <select
            value={selected.type}
            onChange={(e) => {
              const t = e.target.value as WallItemType
              updateItem(wallIndex, selected.id, { type: t, label: itemTypeInfo(t).label })
            }}
            className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs"
          >
            {WALL_ITEM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <span className="tabular-nums text-slate-500">
            {selected.width.toFixed(2)}×{selected.height.toFixed(2)} m
          </span>
          <button
            onClick={() => {
              removeItem(wallIndex, selected.id)
              selectItem(null)
            }}
            className="ml-auto rounded-md bg-white px-2 py-1 font-semibold text-red-600 hover:bg-red-50"
          >
            刪除
          </button>
        </div>
      )}

      {wallCeiling.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          <span className="text-slate-500">從這面牆標的天花板物件：</span>
          {wallCeiling.map((c) => (
            <span key={c.id} className="flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2 pr-1">
              <span className="h-2 w-2 rounded-full" style={{ background: itemTypeInfo(c.type).color }} />
              {c.label}
              <button onClick={() => removeCeilingItem(c.id)} className="px-1 text-slate-400 hover:text-red-500" aria-label={`刪除${c.label}`}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
