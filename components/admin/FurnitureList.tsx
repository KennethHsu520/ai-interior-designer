'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CatalogItem } from '@/types/room'
import { CATEGORY_ICON, categoriesOf } from '@/lib/catalog'
import { deleteFurniture, updateFurniture } from '@/lib/adminApi'
import { getThumbnail } from '@/lib/thumbnails'
import ItemFields, { applyDraft, draftFromItem, draftProblems, type ItemDraft } from './ItemFields'

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
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
      {url ? <img src={url} alt="" className="h-full w-full object-contain" /> : <span className="text-xl opacity-50">{CATEGORY_ICON[item.category] ?? '📦'}</span>}
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
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋名稱、來源、風格" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm">
          {['全部', ...categories].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span className="text-xs text-slate-500">{loading ? '更新中…' : `${list.length} 件`}</span>
      </div>
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
      <ul className="flex flex-col gap-2">
        {list.map((item) => {
          const open = editing === item.id
          const hidden = item.published === false
          return (
            <li key={item.id} className={`rounded-xl border bg-white ${hidden ? 'border-dashed border-slate-300 opacity-75' : 'border-slate-200'}`}>
              <div className="flex items-center gap-3 p-2.5">
                <Thumb item={item} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {item.name} {hidden && <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">已下架</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {item.category}・{item.size.width.toFixed(2)}×{item.size.depth.toFixed(2)}×{item.size.height.toFixed(2)} m・{item.source}・{item.license}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    disabled={busy === item.id}
                    onClick={() => run(item.id, () => updateFurniture(item.id, { published: hidden }), hidden ? `已上架「${item.name}」` : `已下架「${item.name}」`)}
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${hidden ? 'bg-emerald-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {hidden ? '上架' : '下架'}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(open ? null : item.id)
                      setDraft(draftFromItem(item))
                      setConfirmDelete(null)
                    }}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    {open ? '收起' : '編輯'}
                  </button>
                  {confirmDelete === item.id ? (
                    <span className="flex gap-1">
                      <button onClick={() => setConfirmDelete(null)} className="rounded-md border border-slate-200 px-2 py-1 text-xs">
                        取消
                      </button>
                      <button disabled={busy === item.id} onClick={() => run(item.id, () => deleteFurniture(item), `已刪除「${item.name}」`)} className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white">
                        確定刪除
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDelete(item.id)} className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50">
                      刪除
                    </button>
                  )}
                </div>
              </div>
              {confirmDelete === item.id && <p className="px-3 pb-2 text-xs text-red-600">刪除後無法復原；已經擺在使用者房間裡的這件家具會改用內建資料（如果有），否則會消失。建議改用「下架」。</p>}
              {open && draft && (
                <div className="flex flex-col gap-3 border-t border-slate-100 p-3">
                  <ItemFields draft={draft} onChange={setDraft} rawSize={item.rawSize} />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
                      取消
                    </button>
                    <button disabled={busy === item.id} onClick={() => save(item)} className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-bold text-white disabled:bg-slate-300">
                      {busy === item.id ? '儲存中…' : '儲存'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
