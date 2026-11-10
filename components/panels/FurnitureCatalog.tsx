'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Plus, Search, Sparkles } from 'lucide-react'
import { useRoomStore } from '@/store/useRoomStore'
import { CATALOG_MAP, categoriesOf, inCategory, MY_CATEGORY, stylesOf, useCatalog } from '@/lib/catalog'
import { deleteCustomFurniture, getCustomFurniture, type CustomFurniture } from '@/lib/customFurniture'
import CustomFurnitureDialog from './CustomFurnitureDialog'
import { findFreeSpot } from '@/lib/collision'
import { roomCentroid } from '@/lib/layout'
import { requestLayout } from '@/lib/requestLayout'
import { UndoLayoutButton } from '@/components/scene/HistoryControls'
import { getThumbnail } from '@/lib/thumbnails'
import CategoryIcon from '@/components/ui/CategoryIcon'
import Button from '@/components/ui/Button'
import { chipClass, helpTextClass, inputClass, noteClass, selectSmClass, stickyBarClass } from '@/components/ui/fields'
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
    <div ref={ref} className="flex aspect-square w-full items-center justify-center rounded-field bg-surface">
      {url ? <img src={url} alt={item.name} className="h-full w-full object-contain" draggable={false} /> : <CategoryIcon category={item.category} size={22} className="text-ink-4" />}
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
    <div className="flex flex-col gap-4">
      {catalogStatus === 'offline' && <p className={noteClass.warn}>家具資料庫暫時連不上，先顯示內建家具；連線恢復後重新整理頁面即可看到新家具。</p>}
      <button
        onClick={() => setDialog({ editing: null })}
        className="flex items-center justify-center gap-2 rounded-card border border-dashed border-brand-300 bg-brand-50 px-3 py-3 text-sm font-medium text-brand-700 transition-colors duration-200 ease-soft hover:bg-brand-100"
      >
        <Camera size={16} strokeWidth={1.75} />
        找不到？拍照自己做一件
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
      <label className="relative block">
        <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" aria-hidden="true" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋家具，例如：沙發、床、北歐" className={`${inputClass} pl-9`} aria-label="搜尋家具" />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {['全部', ...categories].map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={chipClass(category === c)}>
            {c !== '全部' && <CategoryIcon category={c} size={13} />}
            {c}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-ink-3">
        <span className="shrink-0">風格</span>
        <select value={style} onChange={(e) => setStyle(e.target.value)} className={`${selectSmClass} w-auto`}>
          {['全部', ...styles].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span className="ml-auto shrink-0 whitespace-nowrap tabular-nums">{list.length} 件</span>
      </label>
      <p className={helpTextClass}>點加號直接放進房間，或把卡片拖到 3D 畫面上。勾選多件可以自動配置。</p>
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
              className={`group relative flex cursor-grab flex-col gap-1 rounded-card border p-1.5 transition-[border-color,box-shadow,background-color] duration-200 ease-soft ${
                on ? 'border-brand-400 bg-brand-50' : 'border-line bg-white hover:border-brand-300 hover:shadow-card-hover'
              }`}
            >
              <Thumb item={c} />
              <span className="line-clamp-2 text-[11px] font-medium leading-tight text-ink">{c.name}</span>
              <span className="text-[10px] tabular-nums text-ink-4">
                {c.size.width.toFixed(2)}×{c.size.depth.toFixed(2)}×{c.size.height.toFixed(2)}
              </span>
              <label className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-[6px] bg-white/90 shadow-hairline">
                <input type="checkbox" checked={on} onChange={() => toggle(c.id)} className="accent-brand-500" aria-label={`勾選${c.name}`} />
              </label>
              <button
                onClick={() => addToRoom(c.id)}
                className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-pill bg-brand-500 text-white shadow-hairline transition-colors duration-200 ease-soft hover:bg-brand-600"
                aria-label={`加入${c.name}`}
              >
                <Plus size={14} strokeWidth={2.25} />
              </button>
              {c.custom && confirmDelete !== c.id && (
                <span className="flex gap-1">
                  <button
                    onClick={() => {
                      const rec = getCustomFurniture(c.id)
                      if (rec) setDialog({ editing: rec })
                    }}
                    className="flex-1 rounded-pill border border-line py-0.5 text-[10px] text-ink-2 transition-colors hover:bg-surface"
                  >
                    編輯
                  </button>
                  <button onClick={() => setConfirmDelete(c.id)} className="flex-1 rounded-pill border border-danger/40 py-0.5 text-[10px] text-danger transition-colors hover:bg-danger/10">
                    刪除
                  </button>
                </span>
              )}
              {c.custom && confirmDelete === c.id && (
                <span className="flex flex-col gap-1 rounded-field bg-danger/10 p-1.5 text-[10px] leading-snug text-danger">
                  {(() => {
                    const n = placed.filter((f) => f.catalogId === c.id).length
                    return n ? `房間裡有 ${n} 件，刪除後也會從房間移除（可按復原）` : '確定刪除？'
                  })()}
                  <span className="flex gap-1">
                    <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-pill bg-white py-0.5 text-ink-2">
                      取消
                    </button>
                    <button onClick={() => removeCustom(c.id)} className="flex-1 rounded-pill bg-danger py-0.5 font-medium text-white">
                      刪除
                    </button>
                  </span>
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div className={stickyBarClass}>
        <Button disabled={busy || picked.length === 0} onClick={autoLayout} className="w-full">
          <Sparkles size={16} strokeWidth={1.75} />
          {busy ? '配置中…' : `自動配置勾選的 ${picked.length} 件（連同房內家具）`}
        </Button>
        {note && (
          <div className={noteClass[note.kind]}>
            <p>{note.text}</p>
            <UndoLayoutButton revision={note.revision} />
          </div>
        )}
      </div>
    </div>
  )
}
