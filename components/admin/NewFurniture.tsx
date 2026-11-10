'use client'

import { useEffect, useRef, useState } from 'react'
import { Package, Upload } from 'lucide-react'
import type { CatalogItem } from '@/types/room'
import { processGlb, sha256Hex, type ProcessedModel } from '@/lib/modelProcess'
import { renderThumbnail } from '@/lib/thumbnails'
import { insertFurniture, uploadAssets } from '@/lib/adminApi'
import { fitModel } from '@/lib/modelMeasure'
import Button from '@/components/ui/Button'
import { helpTextClass, noteClass, sectionTitleClass } from '@/components/ui/fields'
import ItemFields, { applyDraft, draftProblems, type ItemDraft } from './ItemFields'

const MB = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`

type Step = { kind: 'idle' } | { kind: 'reading' } | { kind: 'ready'; model: ProcessedModel; url: string; thumb: string | null } | { kind: 'saving'; text: string }

export default function NewFurniture({ existing, onCreated }: { existing: CatalogItem[]; onCreated: () => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>({ kind: 'idle' })
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<ItemDraft>({ name: '', category: '椅', styles: '', source: '', author: '', sourceUrl: '', license: '', fit: 'height', fitValue: 0.8 })
  const ready = step.kind === 'ready' ? step : null

  useEffect(() => {
    const url = ready?.url
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [ready?.url])

  const previewItem = (model: ProcessedModel, url: string): CatalogItem => {
    const fitted = fitModel(model.measure.rawSize, draft.fit, draft.fitValue > 0 ? draft.fitValue : model.measure.rawSize[draft.fit])
    return {
      id: 'preview',
      name: draft.name,
      category: draft.category,
      styles: [],
      source: '',
      license: '',
      file: url,
      size: fitted.size,
      rawSize: model.measure.rawSize,
      rawMin: model.measure.rawMin,
      scale: fitted.scale,
    }
  }

  const onFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setError(null)
    if (!/\.glb$/i.test(file.name)) {
      setError('請選擇 .glb 檔（glTF 二進位格式）')
      return
    }
    if (file.size > 80 * 1024 * 1024) {
      setError('檔案超過 80 MB，請先在 Blender 等工具減面或縮小貼圖')
      return
    }
    setFileName(file.name)
    setStep({ kind: 'reading' })
    try {
      const model = await processGlb(file)
      const url = URL.createObjectURL(new Blob([model.bytes.slice()], { type: 'model/gltf-binary' }))
      const h = model.measure.rawSize.height
      const guess = h > 0.2 && h < 3 ? Math.round(h * 100) / 100 : 0.8
      const base = file.name.replace(/\.glb$/i, '').replace(/[_-]+/g, ' ')
      setDraft((d) => ({ ...d, name: d.name || base, fit: 'height', fitValue: guess }))
      let thumb: string | null = null
      try {
        thumb = await renderThumbnail(previewItem(model, url))
      } catch {}
      setStep({ kind: 'ready', model, url, thumb })
    } catch (e) {
      setError(e instanceof Error ? `讀取模型失敗：${e.message}` : '讀取模型失敗')
      setStep({ kind: 'idle' })
    }
  }

  const submit = async () => {
    if (!ready) return
    const problems = draftProblems(draft)
    if (problems.length) {
      setError(problems.join('、'))
      return
    }
    setError(null)
    const { model, thumb } = ready
    try {
      setStep({ kind: 'saving', text: '計算檔案指紋…' })
      const hash = (await sha256Hex(model.bytes)).slice(0, 20)
      const id = `db/${hash}`
      if (existing.some((c) => c.id === id)) throw new Error('這個模型已經上傳過了')
      setStep({ kind: 'saving', text: '上傳模型與縮圖…' })
      const pngBlob = thumb ? await (await fetch(thumb)).blob() : new Blob([], { type: 'image/png' })
      const urls = await uploadAssets(hash, model.bytes, pngBlob)
      const v = applyDraft(model.measure, draft)
      const item: CatalogItem = {
        id,
        name: v.name,
        category: v.category,
        styles: v.styles,
        source: v.source,
        license: v.license,
        author: v.author,
        sourceUrl: v.sourceUrl,
        file: urls.model,
        thumbnail: thumb ? urls.thumb : undefined,
        size: v.size,
        rawSize: model.measure.rawSize,
        rawMin: model.measure.rawMin,
        scale: v.scale,
        published: true,
      }
      setStep({ kind: 'saving', text: '寫入資料庫…' })
      await insertFurniture(item, Math.floor(Date.now() / 1000))
      setStep({ kind: 'idle' })
      setFileName('')
      setDraft({ name: '', category: draft.category, styles: '', source: draft.source, author: draft.author, sourceUrl: '', license: draft.license, fit: 'height', fitValue: 0.8 })
      await onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : '新增失敗')
      setStep(ready)
    }
  }

  return (
    <section className="flex flex-col gap-5 rounded-card border border-line bg-white p-5 shadow-hairline sm:p-6">
      <div className="flex flex-col gap-1.5">
        <h2 className={sectionTitleClass}>新增家具</h2>
        <p className={helpTextClass}>
          上傳 .glb 後會自動讀取模型範圍、縮小貼圖（最長邊 1024）、用 meshopt 壓縮、產生縮圖，檔名使用內容指紋並設定一年快取，節省 Supabase 免費流量。請只上傳授權允許商用的模型。
        </p>
      </div>

      <button
        onClick={() => fileRef.current?.click()}
        disabled={step.kind === 'reading' || step.kind === 'saving'}
        className="flex flex-col items-center gap-2 rounded-card border-2 border-dashed border-line-2 bg-surface px-4 py-8 text-sm text-ink-2 transition-colors duration-200 ease-soft hover:border-brand-300 hover:bg-brand-50 disabled:opacity-60"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-pill bg-white text-brand-500 shadow-hairline">
          {step.kind === 'reading' ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand-500" /> : <Upload size={20} strokeWidth={1.75} />}
        </span>
        <span className="font-medium text-ink">{step.kind === 'reading' ? '讀取與壓縮中…' : fileName ? `已選擇：${fileName}` : '選擇 .glb 模型檔'}</span>
        <span className="text-xs text-ink-3">{fileName && step.kind !== 'reading' ? '點此更換檔案' : '最大 80 MB，會在瀏覽器裡先壓縮'}</span>
      </button>
      <input ref={fileRef} type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

      {error && <p className={noteClass.error}>{error}</p>}

      {(ready || step.kind === 'saving') && (
        <>
          {ready && (
            <div className="flex flex-wrap items-center gap-5 rounded-card bg-surface p-4">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-field bg-white shadow-hairline">
                {ready.thumb ? <img src={ready.thumb} alt="縮圖預覽" className="h-full w-full object-contain" /> : <Package size={24} strokeWidth={1.5} className="text-ink-4" />}
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs text-ink-2">
                <dt className="text-ink-4">原始範圍</dt>
                <dd className="tabular-nums">
                  {ready.model.measure.rawSize.width} × {ready.model.measure.rawSize.depth} × {ready.model.measure.rawSize.height}（模型單位）
                </dd>
                <dt className="text-ink-4">三角面數</dt>
                <dd className="tabular-nums">{ready.model.triangles.toLocaleString()}</dd>
                <dt className="text-ink-4">檔案大小</dt>
                <dd className="tabular-nums">
                  {MB(ready.model.before)} 壓縮為 <b className="font-medium text-success">{MB(ready.model.after)}</b>（{Math.round((1 - ready.model.after / ready.model.before) * 100)}% 更小）
                </dd>
              </dl>
            </div>
          )}
          <ItemFields draft={draft} onChange={setDraft} rawSize={ready?.model.measure.rawSize ?? { width: 1, depth: 1, height: 1 }} />
          <div className="flex items-center justify-end gap-3">
            {step.kind === 'saving' && <span className="text-sm text-brand-700">{step.text}</span>}
            <Button onClick={submit} disabled={step.kind === 'saving' || !ready}>
              <Upload size={16} strokeWidth={1.75} />
              上傳並上架
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
