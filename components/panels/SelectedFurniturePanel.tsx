'use client'

import { useEffect, useState } from 'react'
import { useRoomStore } from '@/store/useRoomStore'
import { CATALOG_MAP, furnitureColors } from '@/lib/catalog'
import { rolesOf, roleLabel, SWATCHES, type Role } from '@/lib/procedural'
import NumberField from '@/components/ui/NumberField'
import { snapAngle } from '@/lib/collision'
import { useCollisions } from '@/lib/useCollisions'
import { clearanceIssues, cm, wallDistances } from '@/lib/planData'

const STEP = Math.PI / 12

export function useFurnitureShortcuts() {
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
}

export default function SelectedFurniturePanel({ floating = false }: { floating?: boolean }) {
  const id = useRoomStore((s) => s.selectedFurnitureId)
  const f = useRoomStore((s) => s.furniture.find((q) => q.id === s.selectedFurnitureId))
  const updateFurniture = useRoomStore((s) => s.updateFurniture)
  const removeFurniture = useRoomStore((s) => s.removeFurniture)
  const selectFurniture = useRoomStore((s) => s.selectFurniture)
  const collisions = useCollisions()
  const [role, setRole] = useState<Role>('main')
  const room = useRoomStore((s) => s.room)
  const allFurniture = useRoomStore((s) => s.furniture)

  if (!id || !f) return null
  const item = CATALOG_MAP.get(f.catalogId)
  if (!item) return null
  const res = collisions.get(f.id)
  const deg = Math.round((((f.rotationY * 180) / Math.PI) % 360 + 360) % 360)
  const size = f.size ?? item.size
  const roles: Role[] = item.procedural ? rolesOf(item.procedural.kind) : ['main']
  const activeRole = roles.includes(role) ? role : roles[0]
  const colors = furnitureColors(f, item)
  const current = colors[activeRole] ?? ''
  const label = (r: Role) => (item.procedural ? roleLabel(item.procedural.kind, r) : '整體色調')
  const setSize = (key: 'width' | 'depth' | 'height', v: number) => updateFurniture(f.id, { size: { ...size, [key]: v } })
  const setColor = (c: string) => updateFurniture(f.id, { colors: { ...(f.colors ?? {}), [activeRole]: c } })
  const distances = wallDistances(room, f, item).slice(0, 3)
  const advice = clearanceIssues(room, allFurniture, CATALOG_MAP).get(f.id) ?? []
  const changed = !!f.size || !!(f.colors && Object.keys(f.colors).length)

  const tone = res?.ok === false ? 'border-red-300 bg-red-50' : 'border-sky-200 bg-sky-50'

  const head = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{item.name}</h3>
          <p className="text-[11px] tabular-nums text-slate-500">
            {size.width.toFixed(2)} × {size.depth.toFixed(2)} × {size.height.toFixed(2)} m・{deg}°
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
      {advice.length > 0 && (
        <ul className="rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
          {advice.map((a) => (
            <li key={a}>💡 {a}</li>
          ))}
        </ul>
      )}
      {distances.length > 0 && (
        <div className="flex flex-wrap gap-1 text-[11px]">
          <span className="text-slate-500">離牆：</span>
          {distances.map((d) => (
            <span key={d.wall} className={`rounded-full px-2 py-0.5 tabular-nums ${d.distance < 0.005 ? 'bg-slate-800 text-white' : 'bg-white text-slate-700'}`}>
              牆{d.wall + 1} {d.distance < 0.005 ? '貼牆' : `${cm(d.distance)} cm`}
            </span>
          ))}
        </div>
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
    </>
  )

  const editBox = (
      <div className="flex flex-col gap-1.5 rounded-lg bg-white/70 p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">尺寸（公尺）</span>
          {changed && (
            <button onClick={() => updateFurniture(f.id, { size: undefined, colors: undefined })} className="text-[11px] text-slate-400 hover:text-slate-600">
              還原預設
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <NumberField key={`w${f.id}`} compact label="寬" value={size.width} validate={(v) => (v < 0.05 || v > 6 ? '0.05～6' : null)} onCommit={(v) => setSize('width', v)} />
          <NumberField key={`d${f.id}`} compact label="深" value={size.depth} validate={(v) => (v < 0.05 || v > 6 ? '0.05～6' : null)} onCommit={(v) => setSize('depth', v)} />
          <NumberField key={`h${f.id}`} compact label="高" value={size.height} validate={(v) => (v < 0.01 || v > 3 ? '0.01～3' : null)} onCommit={(v) => setSize('height', v)} />
        </div>
        <span className="mt-1 text-xs font-bold text-slate-700">顏色</span>
        {roles.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {roles.map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${activeRole === r ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600'}`}
              >
                <span className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ background: colors[r] }} />
                {label(r)}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-12 gap-1">
          {SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              title={c}
              aria-label={`顏色 ${c}`}
              className={`aspect-square rounded-md border ${current.toLowerCase() === c ? 'border-sky-500 ring-2 ring-sky-300' : 'border-black/10'}`}
              style={{ background: c }}
            />
          ))}
        </div>
        <label className="flex items-center gap-2 text-[11px] text-slate-500">
          自訂{label(activeRole)}顏色
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(current) ? current : '#cccccc'} onChange={(e) => setColor(e.target.value)} className="h-6 w-10 cursor-pointer rounded border border-slate-200" />
        </label>
      </div>
  )

  const hint = <p className="text-[10px] text-slate-400">在 3D 中拖曳移動・鍵盤 R 旋轉、Delete 刪除・藍色三角形是正面</p>

  if (floating)
    return (
      <div className={`@container flex flex-col gap-2 rounded-xl border p-3 shadow-lg backdrop-blur ${tone}`}>
        <div className="grid gap-3 @xl:grid-cols-2">
          <div className="flex flex-col gap-2">{head}</div>
          {editBox}
        </div>
        {hint}
      </div>
    )

  return (
    <div className={`flex flex-col gap-2 rounded-xl border p-3 ${tone}`}>
      {head}
      {editBox}
      {hint}
    </div>
  )
}
