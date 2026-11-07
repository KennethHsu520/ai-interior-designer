'use client'

import { useEffect } from 'react'
import { useRoomStore } from '@/store/useRoomStore'
import { CATALOG_MAP } from '@/lib/catalog'
import { snapAngle } from '@/lib/collision'
import { useCollisions } from '@/lib/useCollisions'

const STEP = Math.PI / 12

export default function SelectedFurniturePanel() {
  const id = useRoomStore((s) => s.selectedFurnitureId)
  const f = useRoomStore((s) => s.furniture.find((q) => q.id === s.selectedFurnitureId))
  const updateFurniture = useRoomStore((s) => s.updateFurniture)
  const removeFurniture = useRoomStore((s) => s.removeFurniture)
  const selectFurniture = useRoomStore((s) => s.selectFurniture)
  const collisions = useCollisions()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return
      const st = useRoomStore.getState()
      const cur = st.furniture.find((q) => q.id === st.selectedFurnitureId)
      if (!cur) return
      if (e.key === 'r' || e.key === 'R') st.updateFurniture(cur.id, { rotationY: snapAngle(cur.rotationY + (e.shiftKey ? -STEP : STEP)) })
      if (e.key === 'Delete' || e.key === 'Backspace') st.removeFurniture(cur.id)
      if (e.key === 'Escape') st.selectFurniture(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!id || !f) return null
  const item = CATALOG_MAP.get(f.catalogId)
  if (!item) return null
  const res = collisions.get(f.id)
  const deg = Math.round((((f.rotationY * 180) / Math.PI) % 360 + 360) % 360)

  return (
    <div className={`flex flex-col gap-2 rounded-xl border p-3 ${res?.ok === false ? 'border-red-300 bg-red-50' : 'border-sky-200 bg-sky-50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{item.name}</h3>
          <p className="text-[11px] tabular-nums text-slate-500">
            {item.size.width.toFixed(2)} × {item.size.depth.toFixed(2)} × {item.size.height.toFixed(2)} m・{deg}°
          </p>
        </div>
        <button onClick={() => selectFurniture(null)} className="text-xs text-slate-400 hover:text-slate-600" aria-label="取消選取">
          ✕
        </button>
      </div>
      {res?.ok === false && (
        <ul className="text-xs text-red-600">
          {res.reasons.map((r) => (
            <li key={r}>⚠️ {r}</li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => updateFurniture(f.id, { rotationY: snapAngle(f.rotationY - STEP) })}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          ↻ 15°
        </button>
        <button
          onClick={() => updateFurniture(f.id, { rotationY: snapAngle(f.rotationY + STEP) })}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          ↺ 15°
        </button>
        <button onClick={() => removeFurniture(f.id)} className="rounded-lg border border-red-200 bg-white px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
          刪除
        </button>
      </div>
      <p className="text-[10px] text-slate-400">在 3D 中拖曳移動・鍵盤 R 旋轉、Delete 刪除・藍色三角形是正面</p>
    </div>
  )
}
