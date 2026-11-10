'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Pencil, Search, Trash } from 'lucide-react'
import type { CatalogItem } from '@/types/room'
import { categoriesOf } from '@/lib/catalog'
import { deleteFurniture, updateFurniture } from '@/lib/adminApi'
import { getThumbnail } from '@/lib/thumbnails'
import CategoryIcon from '@/components/ui/CategoryIcon'
import Button from '@/components/ui/Button'
import { inputClass, noteClass, selectClass, smallBtnClass, smallDangerBtnClass } from '@/components/ui/fields'
import ItemFields, { applyDraft, draftFromItem, draftProblems, type ItemDraft } from './ItemFields'

const ICON = { size: 14, strokeWidth: 1.75 } as const

function Thumb({ item }: { item: CatalogItem }) {
  const [url, setUrl] = useState<string | null>(item.thumbnail ?? null)
  useEffect(() => {
    if (item.thumbnail) return
    let alive = true
    getThumbnail(item).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [item])
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-field bg-surface">
      {url ? <img src={url} alt="" className="h-full w-full object-contain" /> : <CategoryIcon category={item.category} size={20} className="text-ink-4" />}
    </div>
  )
}

export default function FurnitureList({ items, loading, onChanged }: { items: CatalogItem[]; loading: boolean; onChanged: () => Promise<void> }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('全部')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<ItemDraft | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const categories = useMemo(() => categoriesOf(items), [items])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((c) => (category === '全部' || c.category === category) && (!q || `${c.name} ${c.id} ${c.source} ${c.styles.join(' ')}`.toLowerCase().includes(q)))
  }, [items, query, category])

  const run = async (id: string, fn: () => Promise<void>, ok: string) => {
    setBusy(id)
    setMsg(null)
    try {
      await fn()
      await onChanged()
      setMsg({ kind: 'ok', text: ok })
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof Error ? e.message : '操作失敗' })
    } finally {
      setBusy(null)
    }
  }

  const save = (item: CatalogItem) => {
    if (!draft) return
    const problems = draftProblems(draft)
    if (problems.length) {
      setMsg({ kind: 'error', text: problems.join('、') })
      return
    }
    const v = applyDraft(item, draft)
    run(
      item.id,
      () =>
        updateFurniture(item.id, {
          name: v.name,
          category: v.category,
          styles: v.styles,
          source: v.source,
          author: v.author ?? null,
          source_url: v.sourceUrl ?? null,
          license: v.license,
          scale: v.scale,
          size: v.size,
        }),
      `已更新「${v.name}」`,
    ).then(() => setEditing(null))
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋名稱、來源、風格" className={`${inputClass} pl-9`} aria-label="搜尋家具" />
        </label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${selectClass} w-auto`} aria-label="分類">
          {['全部', ...categories].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span className="rounded-pill bg-surface px-3 py-1 text-xs tabular-nums text-ink-3">{loading ? '更新中…' : `${list.length} 件`}</span>
      </div>
      {msg && <p className={noteClass[msg.kind]}>{msg.text}</p>}
      <ul className="flex flex-col gap-2">
        {list.map((item) => {
          const open = editing === item.id
          const hidden = item.published === false
          return (
            <li
              key={item.id}
              className={`rounded-card border bg-white transition-[border-color,box-shadow] duration-200 ease-soft ${
                hidden ? 'border-dashed border-line-2 opacity-70' : open ? 'border-brand-300 shadow-card' : 'border-line hover:border-line-2 hover:shadow-card'
              }`}
            >
              <div className="flex flex-wrap items-center gap-3 p-3">
                <Thumb item={item} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-bold text-ink">
                    <span className="truncate">{item.name}</span>
                    {hidden && <span className="shrink-0 rounded-pill bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-ink-3">已下架</span>}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink-3">
                    {item.category}・{item.size.width.toFixed(2)}×{item.size.depth.toFixed(2)}×{item.size.height.toFixed(2)} m・{item.source}・{item.license}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <button
                    disabled={busy === item.id}
                    onClick={() => run(item.id, () => updateFurniture(item.id, { published: hidden }), hidden ? `已上架「${item.name}」` : `已下架「${item.name}」`)}
                    className={hidden ? 'inline-flex h-8 items-center rounded-pill bg-success px-3 text-xs font-medium text-white transition-colors hover:bg-success/90 disabled:opacity-40' : smallBtnClass}
                  >
                    {hidden ? '上架' : '下架'}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(open ? null : item.id)
                      setDraft(draftFromItem(item))
                      setConfirmDelete(null)
                    }}
                    className={smallBtnClass}
                  >
                    {open ? <ChevronUp {...ICON} /> : <Pencil {...ICON} />}
                    {open ? '收起' : '編輯'}
                  </button>
                  {confirmDelete === item.id ? (
                    <span className="flex gap-1.5">
                      <button onClick={() => setConfirmDelete(null)} className={smallBtnClass}>
                        取消
                      </button>
                      <button
                        disabled={busy === item.id}
                        onClick={() => run(item.id, () => deleteFurniture(item), `已刪除「${item.name}」`)}
                        className="inline-flex h-8 items-center rounded-pill bg-danger px-3 text-xs font-medium text-white transition-colors hover:bg-danger/90 disabled:opacity-40"
                      >
                        確定刪除
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDelete(item.id)} className={smallDangerBtnClass} aria-label={`刪除${item.name}`}>
                      <Trash {...ICON} />
                    </button>
                  )}
                </div>
              </div>
              {confirmDelete === item.id && (
                <p className="mx-3 mb-3 rounded-field bg-danger/10 px-3 py-2 text-xs leading-relaxed text-danger">
                  刪除後無法復原；已經擺在使用者房間裡的這件家具會改用內建資料（如果有），否則會消失。建議改用「下架」。
                </p>
              )}
              {open && draft && (
                <div className="flex flex-col gap-4 border-t border-line p-4">
                  <ItemFields draft={draft} onChange={setDraft} rawSize={item.rawSize} />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                      取消
                    </Button>
                    <Button size="sm" disabled={busy === item.id} onClick={() => save(item)}>
                      {busy === item.id ? '儲存中…' : '儲存'}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
        {!loading && list.length === 0 && (
          <li className="rounded-card border border-dashed border-line-2 px-4 py-10 text-center text-sm text-ink-4">
            <ChevronDown size={18} strokeWidth={1.75} className="mx-auto mb-2 text-ink-4" />
            沒有符合的家具
          </li>
        )}
      </ul>
    </section>
  )
}
