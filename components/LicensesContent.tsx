'use client'

import { useMemo } from 'react'
import { useCatalog } from '@/lib/catalog'
import { useCatalogLoader } from '@/lib/catalogLoader'
import { SOURCE_INFO } from '@/lib/catalogDb'
import { MODEL_LICENSES } from '@/lib/modelLicenses'

const NOTES: Record<string, string> = {
  'KayKit Furniture Bits': '可愛低多邊形風格家具。',
  'Poly Haven': '寫實掃描與建模家具，使用 1K 貼圖版本。',
  'Kenney Furniture Kit': '簡約風格家具。',
  '本站自製（程式生成）': '以程式碼即時產生的參數化家具，尺寸與顏色都可以自由調整。',
}

const STATUS_TEXT: Record<string, string> = {
  online: '資料來自家具資料庫（即時）',
  cached: '資料來自瀏覽器快取，正在更新',
  offline: '家具資料庫暫時連不上，以下為內建家具',
  unconfigured: '尚未設定家具資料庫，以下為內建家具',
  builtin: '載入中…',
}

export default function LicensesContent() {
  useCatalogLoader()
  const items = useCatalog((s) => s.items)
  const status = useCatalog((s) => s.status)
  const listed = useMemo(() => items.filter((c) => !c.custom), [items])
  const sources = useMemo(() => {
    const map = new Map<string, { name: string; author: string; url: string; licenses: Set<string>; count: number }>()
    for (const c of listed) {
      const info = SOURCE_INFO[c.source]
      const cur = map.get(c.source) ?? { name: c.source, author: c.author ?? info?.author ?? '—', url: c.sourceUrl ?? info?.url ?? '', licenses: new Set<string>(), count: 0 }
      cur.licenses.add(c.license)
      cur.count += 1
      if (!cur.url && c.sourceUrl) cur.url = c.sourceUrl
      map.set(c.source, cur)
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [listed])
  const licenses = useMemo(() => Array.from(new Set(listed.map((c) => c.license))), [listed])

  return (
    <>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        本網站只使用授權清楚、可商用的 3D 素材。目前收錄 {listed.length} 件家具，授權包含：{licenses.join('、')}。以下列出每個來源與作者以表感謝。
      </p>
      <p className="mt-1 text-xs text-slate-400">{STATUS_TEXT[status]}</p>
      <ul className="mt-6 flex flex-col gap-4">
        {sources.map((s) => (
          <li key={s.name} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-bold">{s.name}</h2>
              <span className="text-xs text-slate-500">{s.count} 件</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">作者：{s.author}</p>
            <p className="text-sm text-slate-600">授權：{Array.from(s.licenses).join('、')}</p>
            {NOTES[s.name] && <p className="mt-1 text-xs text-slate-500">{NOTES[s.name]}</p>}
            {s.url && (
              <a href={s.url} target="_blank" rel="noreferrer" className="mt-2 inline-block break-all text-sm text-sky-600 hover:underline">
                {s.url}
              </a>
            )}
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-bold">瀏覽器端 AI 模型與函式庫</h2>
      <p className="mt-1 text-sm text-slate-600">以下模型只會在你同意下載後，於你的瀏覽器中執行，本站不呼叫任何付費 AI 服務。</p>
      <ul className="mt-3 flex flex-col gap-3">
        {MODEL_LICENSES.map((m) => (
          <li key={m.name} className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-bold">{m.name}</h3>
            <p className="mt-1 text-sm text-slate-600">用途：{m.use}</p>
            <p className="text-sm text-slate-600">作者：{m.author}</p>
            <p className="text-sm text-slate-600">授權：{m.license}</p>
            <p className="mt-1 text-xs text-slate-500">{m.note}</p>
            <a href={m.url} target="_blank" rel="noreferrer" className="mt-2 inline-block break-all text-sm text-sky-600 hover:underline">
              {m.url}
            </a>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-bold">完整清單</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1">名稱</th>
              <th>分類</th>
              <th>來源</th>
              <th>作者</th>
              <th>授權</th>
            </tr>
          </thead>
          <tbody>
            {listed.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="py-1">{c.name}</td>
                <td>{c.category}</td>
                <td>{c.source}</td>
                <td>{c.author ?? SOURCE_INFO[c.source]?.author ?? '—'}</td>
                <td>{c.license}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
