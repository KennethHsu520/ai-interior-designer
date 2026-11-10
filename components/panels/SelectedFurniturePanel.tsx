'use client'

import { useEffect, useState } from 'react'
import { CircleExclamationPoint, Lightbulb, RotateCcw, RotateCw, Trash, X } from 'lucide-react'
import { useRoomStore } from '@/store/useRoomStore'
import { CATALOG_MAP, furnitureColors, useCatalog } from '@/lib/catalog'
import { rolesOf, roleLabel, SWATCHES, type Role } from '@/lib/procedural'
import NumberField from '@/components/ui/NumberField'
import { snapAngle } from '@/lib/collision'
import { useCollisions } from '@/lib/useCollisions'
import { clearanceIssues, cm, wallDistances } from '@/lib/planData'
import { labelClass, smallBtnClass, smallDangerBtnClass, subTitleClass } from '@/components/ui/fields'

const STEP = Math.PI / 12
const ICON = { size: 14, strokeWidth: 1.75 } as const

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
  useCatalog((s) => s.version)

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

  const tone = res?.ok === false ? 'border-danger/40 bg-danger/5' : 'border-line bg-white'

  const head = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className={subTitleClass}>{item.name}</h3>
          <p className="text-[11px] tabular-nums text-ink-3">
            {size.width.toFixed(2)} × {size.depth.toFixed(2)} × {size.height.toFixed(2)} m・{deg}°
          </p>
        </div>
        <button onClick={() => selectFurniture(null)} className="rounded-pill p-1 text-ink-4 transition-colors hover:bg-surface hover:text-ink" aria-label="取消選取">
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
      {res?.ok === false && (
        <ul className="flex flex-col gap-1 text-xs text-danger">
          {res.reasons.map((r) => (
            <li key={r} className="flex items-start gap-1.5">
              <CircleExclamationPoint {...ICON} className="mt-0.5 shrink-0" />
              {r}
            </li>
          ))}
        </ul>
      )}
      {advice.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-field bg-brand-50 px-3 py-2 text-[11px] leading-relaxed text-brand-700">
          {advice.map((a) => (
            <li key={a} className="flex items-start gap-1.5">
              <Lightbulb {...ICON} className="mt-0.5 shrink-0" />
              {a}
            </li>
          ))}
        </ul>
      )}
      {distances.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          <span className="text-ink-3">離牆：</span>
          {distances.map((d) => (
            <span key={d.wall} className={`rounded-pill px-2 py-0.5 tabular-nums ${d.distance < 0.005 ? 'bg-ink text-white' : 'bg-surface text-ink-2'}`}>
              牆{d.wall + 1} {d.distance < 0.005 ? '貼牆' : `${cm(d.distance)} cm`}
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => updateFurniture(f.id, { rotationY: snapAngle(f.rotationY - STEP) })} className={smallBtnClass}>
          <RotateCcw {...ICON} />
          15°
        </button>
        <button onClick={() => updateFurniture(f.id, { rotationY: snapAngle(f.rotationY + STEP) })} className={smallBtnClass}>
          <RotateCw {...ICON} />
          15°
        </button>
        <button onClick={() => removeFurniture(f.id)} className={smallDangerBtnClass}>
          <Trash {...ICON} />
          刪除
        </button>
      </div>
    </>
  )

  const editBox = (
    <div className="flex flex-col gap-2 rounded-field bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-ink">尺寸（公尺）</span>
        {changed && (
          <button onClick={() => updateFurniture(f.id, { size: undefined, colors: undefined })} className="text-[11px] text-ink-3 transition-colors hover:text-ink">
            還原預設
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <NumberField key={`w${f.id}`} compact label="寬" value={size.width} validate={(v) => (v < 0.05 || v > 6 ? '0.05～6' : null)} onCommit={(v) => setSize('width', v)} />
        <NumberField key={`d${f.id}`} compact label="深" value={size.depth} validate={(v) => (v < 0.05 || v > 6 ? '0.05～6' : null)} onCommit={(v) => setSize('depth', v)} />
        <NumberField key={`h${f.id}`} compact label="高" value={size.height} validate={(v) => (v < 0.01 || v > 3 ? '0.01～3' : null)} onCommit={(v) => setSize('height', v)} />
      </div>
      <span className="mt-1 text-xs font-bold text-ink">顏色</span>
      {roles.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {roles.map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-[11px] transition-colors duration-200 ease-soft ${
                activeRole === r ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-2 hover:bg-surface'
              }`}
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
            className={`aspect-square rounded-[6px] border transition-shadow ${current.toLowerCase() === c ? 'border-brand-500 ring-2 ring-brand-200' : 'border-black/10'}`}
            style={{ background: c }}
          />
        ))}
      </div>
      <label className={`flex items-center gap-2 ${labelClass}`}>
        自訂{label(activeRole)}顏色
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(current) ? current : '#cccccc'} onChange={(e) => setColor(e.target.value)} className="h-7 w-10 cursor-pointer rounded-[6px] border border-line bg-white" />
      </label>
    </div>
  )

  const hint = <p className="text-[10px] text-ink-4">在 3D 中拖曳移動・鍵盤 R 旋轉、Delete 刪除・三角形標記是正面</p>

  if (floating)
    return (
      <div className={`@container flex flex-col gap-3 rounded-card border p-4 shadow-float backdrop-blur-md ${tone}`}>
        <div className="grid gap-3 @xl:grid-cols-2">
          <div className="flex flex-col gap-2.5">{head}</div>
          {editBox}
        </div>
        {hint}
      </div>
    )

  return (
    <div className={`flex flex-col gap-3 rounded-card border p-4 ${tone}`}>
      {head}
      {editBox}
      {hint}
    </div>
  )
}
