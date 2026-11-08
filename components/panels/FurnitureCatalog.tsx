'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRoomStore } from '@/store/useRoomStore'
import { CATALOG_MAP, CATEGORY_ICON, categoriesOf, inCategory, MY_CATEGORY, stylesOf, useCatalog } from '@/lib/catalog'
import { deleteCustomFurniture, getCustomFurniture, type CustomFurniture } from '@/lib/customFurniture'
import CustomFurnitureDialog from './CustomFurnitureDialog'
import { findFreeSpot } from '@/lib/collision'
import { roomCentroid } from '@/lib/layout'
import { requestLayout } from '@/lib/requestLayout'
import { UndoLayoutButton } from '@/components/scene/HistoryControls'
import { getThumbnail } from '@/lib/thumbnails'
import type { CatalogItem } from '@/types/room'

function Thumb({ item }: { item: CatalogItem }) {
  const ref = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let alive = true
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect()
        getThumbnail(item).then((u) => {
          if (alive) setUrl(u)
        })
      }
    })
    io.observe(el)
    return () => {
      alive = false
      io.disconnect()
    }
  }, [item])
  return (
    <div ref={ref} className="flex aspect-square w-full items-center justify-center rounded-lg bg-gradient-to-b from-slate-50 to-slate-100">
      {url ? <img src={url} alt={item.name} className="h-full w-full object-contain" draggable={false} /> : <span className="text-2xl opacity-50">{CATEGORY_ICON[item.category] ?? '📦'}</span>}
    </div>
  )
}

export function addToRoom(catalogId: string, x?: number, z?: number) {
  const st = useRoomStore.getState()
  const c = roomCentroid(st.room)
  const draft = { id: 'draft', catalogId, position: { x: x ?? c.x, y: 0, z: z ?? c.z }, rotationY: 0, scale: 1 }
  const spot = findFreeSpot(st.room, draft, st.furniture, CATALOG_MAP)
  const p = spot ?? draft
  return st.addFurniture(catalogId, p.position.x, p.position.z, p.rotationY)
}

export default function FurnitureCatalog() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('全部')
  const [style, setStyle] = useState<string>('全部')
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string; revision?: number } | null>(null)

  const items = useCatalog((s) => s.items)
  const catalogStatus = useCatalog((s) => s.status)
  const categories = useMemo(() => categoriesOf(items), [items])
  const styles = useMemo(() => stylesOf(items), [items])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(
      (c) =>
        inCategory(c, category) &&
        (style === '全部' || c.styles.includes(style)) &&
        (!q || c.name.toLowerCase().includes(q) || c.category.includes(q) || c.styles.some((s) => s.includes(q)) || c.id.toLowerCase().includes(q)),
    )
  }, [items, query, category, style])

  const [dialog, setDialog] = useState<{ editing: CustomFurniture | null } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const placed = useRoomStore((s) => s.furniture)

  const removeCustom = async (id: string) => {
    const st = useRoomStore.getState()
    const inRoom = st.furniture.filter((f) => f.catalogId === id)
    if (inRoom.length) st.setFurnitureList(st.furniture.filter((f) => f.catalogId !== id))
    await deleteCustomFurniture(id)
    setConfirmDelete(null)
  }

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const autoLayout = async () => {
    setBusy(true)
    setNote(null)
    try {
      picked.forEach((id) => addToRoom(id))
      setPicked([])
      const r = await requestLayout()
      setNote({ kind: r.failed ? 'warn' : 'ok', text: r.explanation, revision: r.revision })
    } catch (e) {
      setNote({ kind: 'error', text: e instanceof Error ? e.message : '配置失敗' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {catalogStatus === 'offline' && (
        <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">家具資料庫暫時連不上，先顯示內建家具；連線恢復後重新整理頁面即可看到新家具。</p>
      )}
      <button
        onClick={() => setDialog({ editing: null })}
        className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-violet-300 bg-violet-50 px-3 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-100"
      >
        📸 找不到？拍照自己做一件
      </button>
      {dialog && (
        <CustomFurnitureDialog
          editing={dialog.editing}
          onClose={(saved) => {
            setDialog(null)
            if (saved && !dialog.editing) setCategory(MY_CATEGORY)
          }}
        />
      )}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜尋家具，例如：沙發、床、北歐"
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300"
      />
      <div className="flex flex-wrap gap-1">
        {['全部', ...categories].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${category === c ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {c !== '全部' && (CATEGORY_ICON[c] ?? '')} {c}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-500">
        風格
        <select value={style} onChange={(e) => setStyle(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs">
          {['全部', ...styles].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span className="ml-auto">{list.length} 件</span>
      </label>
      <p className="text-[11px] text-slate-500">點「＋」直接放進房間，或把卡片拖到 3D 畫面上。勾選多件可以自動配置。</p>
      <div className="grid grid-cols-3 gap-2">
        {list.map((c) => {
          const on = picked.includes(c.id)
          return (
            <div
              key={c.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', c.id)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              className={`group relative flex cursor-grab flex-col gap-1 rounded-xl border p-1.5 ${on ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white hover:border-sky-300'}`}
            >
              <Thumb item={c} />
              <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-700">{c.name}</span>
              <span className="text-[10px] tabular-nums text-slate-400">
                {c.size.width.toFixed(2)}×{c.size.depth.toFixed(2)}×{c.size.height.toFixed(2)}
              </span>
              <label className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded bg-white/90 shadow-sm">
                <input type="checkbox" checked={on} onChange={() => toggle(c.id)} className="accent-violet-600" aria-label={`勾選${c.name}`} />
              </label>
              <button
                onClick={() => addToRoom(c.id)}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white shadow hover:bg-sky-500"
                aria-label={`加入${c.name}`}
              >
                ＋
              </button>
              {c.custom && confirmDelete !== c.id && (
                <span className="flex gap-1">
                  <button
                    onClick={() => {
                      const rec = getCustomFurniture(c.id)
                      if (rec) setDialog({ editing: rec })
                    }}
                    className="flex-1 rounded-md border border-slate-200 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50"
                  >
                    編輯
                  </button>
                  <button onClick={() => setConfirmDelete(c.id)} className="flex-1 rounded-md border border-red-200 py-0.5 text-[10px] text-red-600 hover:bg-red-50">
                    刪除
                  </button>
                </span>
              )}
              {c.custom && confirmDelete === c.id && (
                <span className="flex flex-col gap-1 rounded-md bg-red-50 p-1 text-[10px] text-red-700">
                  {(() => {
                    const n = placed.filter((f) => f.catalogId === c.id).length
                    return n ? `房間裡有 ${n} 件，刪除後也會從房間移除（可按復原）` : '確定刪除？'
                  })()}
                  <span className="flex gap-1">
                    <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded bg-white py-0.5 text-slate-600">
                      取消
                    </button>
                    <button onClick={() => removeCustom(c.id)} className="flex-1 rounded bg-red-600 py-0.5 font-semibold text-white">
                      刪除
                    </button>
                  </span>
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <button
          disabled={busy || picked.length === 0}
          onClick={autoLayout}
          className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? '配置中…' : `✨ 自動配置勾選的 ${picked.length} 件（連同房內家具）`}
        </button>
        {note && (
          <div className={`rounded-lg px-2 py-1.5 text-xs ${note.kind === 'ok' ? 'bg-emerald-100 text-emerald-800' : note.kind === 'warn' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}`}>
            <p>{note.text}</p>
            <UndoLayoutButton revision={note.revision} />
          </div>
        )}
      </div>
    </div>
  )
}
