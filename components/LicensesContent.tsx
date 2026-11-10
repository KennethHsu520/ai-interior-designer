'use client'

import { useMemo } from 'react'
import { Cpu, ExternalLink, Package } from 'lucide-react'
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

function SectionHead({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="max-w-2xl">
      <span className="text-[13px] font-medium uppercase tracking-wider text-brand-600">{eyebrow}</span>
      <h2 className="mt-2 text-h3 font-bold text-ink">{title}</h2>
      <p className="mt-2 text-body-sm text-ink-2">{text}</p>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="flex gap-3 text-sm">
      <span className="w-10 shrink-0 text-ink-4">{label}</span>
      <span className="min-w-0 text-ink-2">{children}</span>
    </p>
  )
}

function ExtLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="mt-3 inline-flex max-w-full items-center gap-1 text-sm text-brand-600 transition-colors hover:text-brand-700">
      <span className="truncate">{href.replace(/^https?:\/\//, '')}</span>
      <ExternalLink size={13} strokeWidth={1.75} className="shrink-0" />
    </a>
  )
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
      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-card border border-line bg-white px-5 py-4 shadow-hairline">
        <span className="text-sm text-ink-2">
          目前收錄 <b className="font-bold tabular-nums text-ink">{listed.length}</b> 件家具
        </span>
        <span className="text-sm text-ink-2">授權包含：{licenses.join('、')}</span>
        <span className="ml-auto inline-flex items-center gap-2 text-xs text-ink-3">
          <span className={`h-1.5 w-1.5 rounded-full ${status === 'online' ? 'bg-success' : status === 'offline' ? 'bg-danger' : 'bg-brand-400'}`} />
          {STATUS_TEXT[status]}
        </span>
      </div>

      <section className="mt-20">
        <SectionHead eyebrow="3D 家具素材" title="素材來源" text="以下列出每個來源與作者，以及該來源收錄的件數。" />
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {sources.map((s) => (
            <li key={s.name} className="flex flex-col rounded-card border border-line bg-white p-6 shadow-hairline transition-[box-shadow,transform] duration-300 ease-soft hover:-translate-y-0.5 hover:shadow-card-hover">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-brand-100 text-brand-600">
                  <Package size={20} strokeWidth={1.75} />
                </span>
                <span className="rounded-pill bg-surface px-2.5 py-0.5 text-xs tabular-nums text-ink-3">{s.count} 件</span>
              </div>
              <h3 className="mt-4 text-[17px] font-bold tracking-tight text-ink">{s.name}</h3>
              {NOTES[s.name] && <p className="mt-1 text-sm text-ink-3">{NOTES[s.name]}</p>}
              <div className="mt-4 flex flex-col gap-1.5">
                <Row label="作者">{s.author}</Row>
                <Row label="授權">{Array.from(s.licenses).join('、')}</Row>
              </div>
              {s.url && <ExtLink href={s.url} />}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-20">
        <SectionHead eyebrow="瀏覽器端 AI" title="模型與函式庫" text="以下模型只會在你同意下載後，於你的瀏覽器中執行，本站不呼叫任何付費 AI 服務。" />
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {MODEL_LICENSES.map((m) => (
            <li key={m.name} className="flex flex-col rounded-card border border-line bg-white p-6 shadow-hairline transition-[box-shadow,transform] duration-300 ease-soft hover:-translate-y-0.5 hover:shadow-card-hover">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-sage-100 text-sage-700">
                <Cpu size={20} strokeWidth={1.75} />
              </span>
              <h3 className="mt-4 text-[17px] font-bold tracking-tight text-ink">{m.name}</h3>
              <p className="mt-1 text-sm text-ink-3">{m.note}</p>
              <div className="mt-4 flex flex-col gap-1.5">
                <Row label="用途">{m.use}</Row>
                <Row label="作者">{m.author}</Row>
                <Row label="授權">{m.license}</Row>
              </div>
              <ExtLink href={m.url} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-20">
        <SectionHead eyebrow="完整清單" title={`全部 ${listed.length} 件家具`} text="每一件家具的名稱、分類、來源、作者與授權。" />
        <div className="mt-8 overflow-hidden rounded-card border border-line bg-white shadow-hairline">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs font-medium text-ink-3">
                <tr>
                  <th className="px-5 py-3 font-medium">名稱</th>
                  <th className="px-3 py-3 font-medium">分類</th>
                  <th className="px-3 py-3 font-medium">來源</th>
                  <th className="px-3 py-3 font-medium">作者</th>
                  <th className="px-5 py-3 font-medium">授權</th>
                </tr>
              </thead>
              <tbody>
                {listed.map((c) => (
                  <tr key={c.id} className="border-t border-line transition-colors hover:bg-surface/60">
                    <td className="px-5 py-2.5 text-ink">{c.name}</td>
                    <td className="px-3 py-2.5 text-ink-2">{c.category}</td>
                    <td className="px-3 py-2.5 text-ink-2">{c.source}</td>
                    <td className="px-3 py-2.5 text-ink-2">{c.author ?? SOURCE_INFO[c.source]?.author ?? '—'}</td>
                    <td className="px-5 py-2.5 text-ink-2">{c.license}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  )
}
