import Link from 'next/link'
import type { Metadata } from 'next'
import { CATALOG } from '@/lib/catalog'

export const metadata: Metadata = { title: '素材來源與授權｜AI室內設計師' }

const SOURCES = [
  {
    name: 'KayKit Furniture Bits',
    author: 'Kay Lousberg',
    url: 'https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0',
    license: 'CC0 1.0（公眾領域）',
    note: '可愛低多邊形風格家具。作者網站：kaylousberg.com',
  },
  {
    name: 'Poly Haven',
    author: 'Poly Haven 社群與作者群',
    url: 'https://polyhaven.com/models',
    license: 'CC0 1.0（公眾領域）',
    note: '寫實掃描與建模家具，使用 1K 貼圖版本。',
  },
  {
    name: 'Kenney Furniture Kit',
    author: 'Kenney (kenney.nl)',
    url: 'https://kenney.nl/assets/furniture-kit',
    license: 'CC0 1.0（公眾領域）',
    note: '簡約風格家具。將 GLB 放入 public/models/kenney/ 後執行 npm run catalog 即會加入目錄。',
  },
  {
    name: '本站自製（程式生成）',
    author: 'AI室內設計師',
    url: '/',
    license: 'CC0 1.0（公眾領域）',
    note: '以程式碼即時產生的參數化家具，尺寸與顏色都可以自由調整。',
  },
]

export default function LicensesPage() {
  const counts = new Map<string, number>()
  for (const c of CATALOG) counts.set(c.source, (counts.get(c.source) ?? 0) + 1)
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-slate-800">
      <Link href="/" className="text-sm text-sky-600 hover:underline">
        ← 回到設計畫面
      </Link>
      <h1 className="mt-4 text-2xl font-black">素材來源與授權</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        本網站只使用授權清楚、可商用的 3D 素材。目前收錄 {CATALOG.length} 件家具，全部為 CC0 授權，可自由使用、修改與商用，不需標示出處；以下仍列出作者以表感謝。
      </p>
      <ul className="mt-6 flex flex-col gap-4">
        {SOURCES.map((s) => (
          <li key={s.name} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-bold">{s.name}</h2>
              <span className="text-xs text-slate-500">{counts.get(s.name) ?? 0} 件</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">作者：{s.author}</p>
            <p className="text-sm text-slate-600">授權：{s.license}</p>
            <p className="mt-1 text-xs text-slate-500">{s.note}</p>
            <a href={s.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-sky-600 hover:underline">
              {s.url}
            </a>
          </li>
        ))}
      </ul>
      <h2 className="mt-8 text-lg font-bold">完整清單</h2>
      <table className="mt-2 w-full text-left text-xs">
        <thead className="text-slate-500">
          <tr>
            <th className="py-1">名稱</th>
            <th>分類</th>
            <th>來源</th>
            <th>授權</th>
          </tr>
        </thead>
        <tbody>
          {CATALOG.map((c) => (
            <tr key={c.id} className="border-t border-slate-100">
              <td className="py-1">{c.name}</td>
              <td>{c.category}</td>
              <td>{c.source}</td>
              <td>{c.license}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-8 text-xs text-slate-400">
        CC0 1.0 全文：
        <a href="https://creativecommons.org/publicdomain/zero/1.0/" className="text-sky-600 hover:underline" target="_blank" rel="noreferrer">
          creativecommons.org/publicdomain/zero/1.0
        </a>
      </p>
    </main>
  )
}
