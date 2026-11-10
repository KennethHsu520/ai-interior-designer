'use client'

import { useRef } from 'react'
import { useRoomStore } from '@/store/useRoomStore'
import { itemTypeInfo, type PhotoBounds, type WallItem } from '@/types/room'

type Drag = { id: string; mode: 'move' | 'resize'; x: number; y: number; item: WallItem }

export default function WallElevation({
  wallIndex,
  length,
  height,
  items,
  photo,
  bounds,
}: {
  wallIndex: number
  length: number
  height: number
  items: WallItem[]
  photo: string | null
  bounds?: PhotoBounds
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const selectedItemId = useRoomStore((s) => s.selectedItemId)
  const selectItem = useRoomStore((s) => s.selectItem)
  const updateItem = useRoomStore((s) => s.updateItem)

  const b = bounds ?? { x0: 0, x1: 1, y0: 0, y1: 1 }
  const bw = b.x1 - b.x0
  const bh = b.y1 - b.y0

  const metersPerPx = () => {
    const r = ref.current?.getBoundingClientRect()
    return r ? { x: length / r.width, y: height / r.height } : { x: 0, y: 0 }
  }

  const start = (e: React.PointerEvent, item: WallItem, mode: Drag['mode']) => {
    e.stopPropagation()
    e.preventDefault()
    selectItem(item.id)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { id: item.id, mode, x: e.clientX, y: e.clientY, item }
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const m = metersPerPx()
    const dx = (e.clientX - d.x) * m.x
    const dy = (e.clientY - d.y) * m.y
    const r = (v: number) => Math.round(v * 100) / 100
    if (d.mode === 'move') updateItem(wallIndex, d.id, { offset: r(d.item.offset + dx), elevation: r(d.item.elevation - dy) })
    else {
      const width = Math.max(0.03, d.item.width + dx)
      const h = Math.max(0.03, d.item.height + dy)
      updateItem(wallIndex, d.id, { width: r(width), height: r(h), elevation: r(d.item.elevation + d.item.height - h) })
    }
  }
  const end = () => {
    drag.current = null
  }

  return (
    <div
      ref={ref}
      className="relative w-full touch-none overflow-hidden rounded-field border border-line-2 bg-[#f4f1ec] select-none"
      style={{ aspectRatio: `${length} / ${height}` }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerDown={() => selectItem(null)}
    >
      {photo && (
        <img
          src={photo}
          alt="牆面照片"
          draggable={false}
          className="pointer-events-none absolute max-w-none opacity-80"
          style={{
            width: `${100 / bw}%`,
            height: `${100 / bh}%`,
            left: `${(-b.x0 / bw) * 100}%`,
            top: `${(-b.y0 / bh) * 100}%`,
          }}
        />
      )}
      {!photo && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-ink-4">尚未拍照（仍可手動新增物件）</div>
      )}
      {items.map((it) => {
        const info = itemTypeInfo(it.type)
        const sel = it.id === selectedItemId
        return (
          <div
            key={it.id}
            onPointerDown={(e) => start(e, it, 'move')}
            className={`absolute cursor-move rounded-sm border-2 ${sel ? 'z-10 ring-2 ring-brand-400' : ''}`}
            style={{
              left: `${(it.offset / length) * 100}%`,
              width: `${(it.width / length) * 100}%`,
              bottom: `${(it.elevation / height) * 100}%`,
              height: `${(it.height / height) * 100}%`,
              borderColor: info.color,
              background: `${info.color}${it.confirmed ? '55' : '30'}`,
              borderStyle: it.confirmed ? 'solid' : 'dashed',
              minWidth: 6,
              minHeight: 6,
            }}
          >
            <span
              className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded px-1 text-[9px] font-medium text-white"
              style={{ background: info.color }}
            >
              {info.label}
            </span>
            {sel && (
              <span
                onPointerDown={(e) => start(e, it, 'resize')}
                className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-se-resize rounded-full border-2 border-white bg-brand-500 shadow-card"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
