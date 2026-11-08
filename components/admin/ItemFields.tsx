'use client'

import { CATEGORY_ORDER } from '@/lib/catalog'
import { fitModel, type FitAxis } from '@/lib/modelMeasure'
import type { CatalogItem } from '@/types/room'

export type ItemDraft = {
  name: string
  category: string
  styles: string
  source: string
  author: string
  sourceUrl: string
  license: string
  fit: FitAxis
  fitValue: number
}

export const LICENSE_PRESETS = ['CC0 1.0', 'CC BY 4.0', 'CC BY-SA 4.0', 'MIT', '自行建模（本站擁有）']

const AXIS_LABEL: Record<FitAxis, string> = { width: '寬', depth: '深', height: '高' }

export function draftFromItem(item: CatalogItem): ItemDraft {
  return {
    name: item.name,
    category: item.category,
    styles: item.styles.join('、'),
    source: item.source,
    author: item.author ?? '',
    sourceUrl: item.sourceUrl ?? '',
    license: item.license,
    fit: 'width',
    fitValue: item.size.width,
  }
}

export function applyDraft(base: Pick<CatalogItem, 'rawSize'>, d: ItemDraft) {
  const fitted = fitModel(base.rawSize, d.fit, d.fitValue)
  return {
    name: d.name.trim(),
    category: d.category,
    styles: d.styles
      .split(/[、,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    source: d.source.trim(),
    author: d.author.trim() || undefined,
    sourceUrl: d.sourceUrl.trim() || undefined,
    license: d.license.trim(),
    scale: fitted.scale,
    size: fitted.size,
  }
}

export function draftProblems(d: ItemDraft) {
  const out: string[] = []
  if (!d.name.trim()) out.push('請填名稱')
  if (!d.source.trim()) out.push('請填來源')
  if (!d.license.trim()) out.push('授權為必填')
  if (!(d.fitValue > 0.02 && d.fitValue < 8)) out.push('實際尺寸需介於 0.02～8 公尺')
  if (d.sourceUrl.trim() && !/^https?:\/\//.test(d.sourceUrl.trim())) out.push('來源網址需以 http 開頭')
  return out
}

const input = 'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-300'
const label = 'flex flex-col gap-1 text-xs font-semibold text-slate-600'

export default function ItemFields({ draft, onChange, rawSize }: { draft: ItemDraft; onChange: (d: ItemDraft) => void; rawSize: CatalogItem['rawSize'] }) {
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => onChange({ ...draft, [k]: v })
  const preview = draft.fitValue > 0 ? fitModel(rawSize, draft.fit, draft.fitValue).size : null
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={label}>
        名稱
        <input className={input} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="例如：胡桃木書桌" />
      </label>
      <label className={label}>
        分類
        <select className={input} value={draft.category} onChange={(e) => set('category', e.target.value)}>
          {CATEGORY_ORDER.filter((c) => c !== '我的家具').map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className={label}>
        風格標籤（用頓號或逗號分隔）
        <input className={input} value={draft.styles} onChange={(e) => set('styles', e.target.value)} placeholder="北歐、現代" />
      </label>
      <label className={label}>
        授權（必填）
        <input className={input} list="license-presets" value={draft.license} onChange={(e) => set('license', e.target.value)} placeholder="CC0 1.0" />
        <datalist id="license-presets">
          {LICENSE_PRESETS.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </label>
      <label className={label}>
        來源
        <input className={input} value={draft.source} onChange={(e) => set('source', e.target.value)} placeholder="Poly Haven、Sketchfab、自行建模…" />
      </label>
      <label className={label}>
        作者
        <input className={input} value={draft.author} onChange={(e) => set('author', e.target.value)} />
      </label>
      <label className={`${label} sm:col-span-2`}>
        來源網址
        <input className={input} value={draft.sourceUrl} onChange={(e) => set('sourceUrl', e.target.value)} placeholder="https://" />
      </label>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs font-semibold text-slate-600">實際尺寸（依其中一邊等比例縮放）</span>
        <div className="flex flex-wrap items-center gap-2">
          <select className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={draft.fit} onChange={(e) => set('fit', e.target.value as FitAxis)}>
            {(Object.keys(AXIS_LABEL) as FitAxis[]).map((a) => (
              <option key={a} value={a}>
                以「{AXIS_LABEL[a]}」為準
              </option>
            ))}
          </select>
          <input
            type="number"
            step={0.01}
            min={0.02}
            className="w-28 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
            value={Number.isFinite(draft.fitValue) ? draft.fitValue : ''}
            onChange={(e) => set('fitValue', Number(e.target.value))}
          />
          <span className="text-sm text-slate-500">公尺</span>
          {preview && (
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs tabular-nums text-slate-600">
              → 寬 {preview.width.toFixed(2)} × 深 {preview.depth.toFixed(2)} × 高 {preview.height.toFixed(2)} m
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
