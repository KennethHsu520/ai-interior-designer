'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { compressImage, loadPhoto, savePhoto } from '@/lib/image'
import { extractColors } from '@/lib/colorExtract'
import { KINDS, rolesOf, roleLabel, SWATCHES, type Role } from '@/lib/procedural'
import { CATEGORY_ICON } from '@/lib/catalog'
import { CUSTOM_PREFIX, defaultColors, kindOf, saveCustomFurniture, type CustomFurniture } from '@/lib/customFurniture'
import { PROCEDURAL_CATALOG } from '@/lib/procedural'
import { getThumbnail } from '@/lib/thumbnails'
import { ProceduralModel } from '@/components/scene/FurnitureMesh'
import type { CatalogItem } from '@/types/room'

const KIND_CATEGORIES = Array.from(new Set(KINDS.map((k) => k.category)))

function KindThumb({ kind }: { kind: string }) {
  const sample = useMemo(() => PROCEDURAL_CATALOG.find((c) => c.procedural?.kind === kind) as CatalogItem | undefined, [kind])
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!sample) return
    let alive = true
    getThumbnail(sample).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [sample])
  return <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-slate-50">{url ? <img src={url} alt="" className="h-full w-full object-contain" /> : <span className="text-lg opacity-40">…</span>}</div>
}

function assignColors(kind: string, palette: string[]) {
  const base = defaultColors(kind)
  const roles = rolesOf(kind)
  roles.forEach((r, i) => {
    if (palette[i]) base[r] = palette[i]
  })
  return base
}

export default function CustomFurnitureDialog({ editing, onClose }: { editing?: CustomFurniture | null; onClose: (saved?: CustomFurniture) => void }) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoChanged, setPhotoChanged] = useState(false)
  const [palette, setPalette] = useState<string[]>([])
  const [category, setCategory] = useState<string>(editing ? (kindOf(editing.kind)?.category ?? KIND_CATEGORIES[0]) : '沙發')
  const [kind, setKind] = useState<string>(editing?.kind ?? 'sofa-2')
  const [size, setSize] = useState(editing?.size ?? { width: 1.5, depth: 0.88, height: 0.82 })
  const [colors, setColors] = useState<Record<string, string>>(editing?.colors ?? defaultColors('sofa-2'))
  const [role, setRole] = useState<Role>('main')
  const [name, setName] = useState(editing?.name ?? kindOf('sofa-2')?.name ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!editing?.photoRef) return
    let alive = true
    loadPhoto(editing.photoRef).then((u) => {
      if (!alive || !u) return
      setPhoto(u)
      extractColors(u).then((p) => alive && setPalette(p))
    })
    return () => {
      alive = false
    }
  }, [editing])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const roles = rolesOf(kind)
  const activeRole = roles.includes(role) ? role : roles[0]
  const info = kindOf(kind)

  const chooseKind = (k: string) => {
    const meta = kindOf(k)
    setKind(k)
    if (meta) setSize({ width: meta.size[0], depth: meta.size[1], height: meta.size[2] })
    setColors(palette.length ? assignColors(k, palette) : defaultColors(k))
    if (!name.trim() || KINDS.some((x) => x.name === name)) setName(meta?.name ?? '')
  }

  const onFile = async (file: File | undefined) => {
    if (cameraRef.current) cameraRef.current.value = ''
    if (galleryRef.current) galleryRef.current.value = ''
    if (!file) return
    setBusy('分析照片顏色中…')
    setError(null)
    try {
      const url = await compressImage(file, 1024, 0.85)
      setPhoto(url)
      setPhotoChanged(true)
      const p = await extractColors(url)
      setPalette(p)
      if (p.length) setColors(assignColors(kind, p))
    } catch {
      setError('無法讀取這張照片，請換一張試試')
    } finally {
      setBusy(null)
    }
  }

  const sizeOk = size.width >= 0.05 && size.width <= 6 && size.depth >= 0.05 && size.depth <= 6 && size.height >= 0.02 && size.height <= 3
  const canSave = !!name.trim() && sizeOk && !busy

  const save = async () => {
    if (!canSave) return
    setBusy('儲存中…')
    setError(null)
    try {
      const id = editing?.id ?? `${CUSTOM_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
      let photoRef = editing?.photoRef
      if (photo && photoChanged) photoRef = await savePhoto(`${id}_photo_${Date.now()}`, photo)
      const item: CustomFurniture = {
        id,
        name: name.trim(),
        kind,
        size: { width: Math.round(size.width * 100) / 100, depth: Math.round(size.depth * 100) / 100, height: Math.round(size.height * 100) / 100 },
        colors,
        photoRef,
        createdAt: editing?.createdAt ?? Date.now(),
      }
      await saveCustomFurniture(item)
      onClose(item)
    } catch {
      setError('儲存失敗，可能是瀏覽器儲存空間不足')
      setBusy(null)
    }
  }

  const sizeField = (key: 'width' | 'depth' | 'height', label: string) => (
    <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-500">
      {label}
      <span className="flex items-center rounded-lg border border-slate-200 bg-white px-2 focus-within:ring-2 focus-within:ring-sky-300">
        <input
          type="number"
          step={0.01}
          min={0.02}
          value={size[key]}
          onChange={(e) => setSize({ ...size, [key]: Number(e.target.value) })}
          className="w-full min-w-0 bg-transparent py-1.5 text-sm font-normal text-slate-800 outline-none"
        />
        <span className="text-xs font-normal text-slate-400">m</span>
      </span>
    </label>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/50 sm:items-center sm:p-4" onClick={() => onClose()}>
      <div onClick={(e) => e.stopPropagation()} className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:max-w-3xl sm:rounded-2xl" role="dialog" aria-modal="true" aria-label="自己做一件家具">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-base font-bold">{editing ? `編輯「${editing.name}」` : '自己做一件家具'}</h2>
            <p className="text-[11px] text-slate-500">拍照、選類型、量尺寸，顏色會自動從照片取出。資料只存在你的瀏覽器。</p>
          </div>
          <button onClick={() => onClose()} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="關閉">
            ✕
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:grid-cols-[1fr_280px]">
          <div className="flex min-w-0 flex-col gap-4">
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-slate-800">① 家具照片</h3>
              <div className="flex items-center gap-3">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                  {photo ? <img src={photo} alt="家具照片" className="h-full w-full object-cover" /> : <span className="text-2xl opacity-40">📷</span>}
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="flex gap-2">
                    <button onClick={() => cameraRef.current?.click()} className="flex-1 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500">
                      📷 拍照
                    </button>
                    <button onClick={() => galleryRef.current?.click()} className="flex-1 rounded-lg border border-sky-300 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50">
                      🖼️ {photo ? '換一張' : '上傳照片'}
                    </button>
                  </div>
                  {palette.length > 0 && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      照片主色
                      {palette.map((c) => (
                        <span key={c} className="h-4 w-4 rounded border border-black/10" style={{ background: c }} title={c} />
                      ))}
                    </div>
                  )}
                  {!photo && <span className="text-[11px] text-slate-400">照片可以略過，之後也能手動選顏色</span>}
                </div>
              </div>
              <input ref={cameraRef} type="file" accept="image/*,.heic,.heif" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              <input ref={galleryRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-slate-800">② 家具類型</h3>
              <div className="flex flex-wrap gap-1">
                {KIND_CATEGORIES.map((c) => (
                  <button key={c} onClick={() => setCategory(c)} className={`rounded-full px-2.5 py-1 text-xs font-medium ${category === c ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {CATEGORY_ICON[c] ?? ''} {c}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {KINDS.filter((k) => k.category === category).map((k) => (
                  <button
                    key={k.kind}
                    onClick={() => chooseKind(k.kind)}
                    className={`flex flex-col gap-1 rounded-xl border p-1.5 text-left ${kind === k.kind ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200' : 'border-slate-200 hover:border-sky-300'}`}
                  >
                    <KindThumb kind={k.kind} />
                    <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-700">{k.name}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-slate-800">③ 實際尺寸（請用捲尺量）</h3>
              <div className="grid grid-cols-3 gap-2">
                {sizeField('width', '寬')}
                {sizeField('depth', '深')}
                {sizeField('height', '高')}
              </div>
              {!sizeOk && <p className="text-[11px] text-red-600">寬、深需介於 0.05～6 公尺，高需介於 0.02～3 公尺</p>}
              {info && (
                <button onClick={() => setSize({ width: info.size[0], depth: info.size[1], height: info.size[2] })} className="self-start text-[11px] text-sky-600 hover:underline">
                  改回常見尺寸（{info.size.join(' × ')} m）
                </button>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-slate-800">④ 顏色</h3>
              {roles.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  {roles.map((r) => (
                    <button key={r} onClick={() => setRole(r)} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${activeRole === r ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600'}`}>
                      <span className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ background: colors[r] }} />
                      {roleLabel(kind, r)}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-12 gap-1">
                {[...palette, ...SWATCHES.filter((s) => !palette.includes(s))].slice(0, 24).map((c) => (
                  <button
                    key={c}
                    onClick={() => setColors({ ...colors, [activeRole]: c })}
                    className={`aspect-square rounded-md border ${colors[activeRole]?.toLowerCase() === c.toLowerCase() ? 'border-sky-500 ring-2 ring-sky-300' : 'border-black/10'}`}
                    style={{ background: c }}
                    aria-label={`顏色 ${c}`}
                    title={palette.includes(c) ? `照片取色 ${c}` : c}
                  />
                ))}
              </div>
              <label className="flex items-center gap-2 text-[11px] text-slate-500">
                自訂{roleLabel(kind, activeRole)}顏色
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(colors[activeRole] ?? '') ? colors[activeRole] : '#cccccc'} onChange={(e) => setColors({ ...colors, [activeRole]: e.target.value })} className="h-6 w-10 cursor-pointer rounded border border-slate-200" />
              </label>
            </section>
          </div>

          <aside className="flex flex-col gap-3 sm:sticky sm:top-0 sm:self-start">
            <div className="aspect-square w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-50 to-slate-200">
              <Canvas camera={{ position: [2.2, 1.6, 2.6], fov: 35 }} dpr={[1, 2]}>
                <hemisphereLight args={['#ffffff', '#8a8070', 2.2]} />
                <directionalLight position={[3, 5, 4]} intensity={2} />
                <group position={[0, -size.height / 2, 0]}>
                  <ProceduralModel kind={kind} size={size} colors={colors} />
                </group>
                <OrbitControls enablePan={false} minDistance={1} maxDistance={8} autoRotate autoRotateSpeed={1.2} />
              </Canvas>
            </div>
            <p className="text-center text-[11px] text-slate-400">拖曳可以旋轉預覽</p>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              ⑤ 名稱
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：客廳的灰色沙發" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-sky-300" />
            </label>
            {error && <p className="rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</p>}
            <button disabled={!canSave} onClick={save} className="rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:bg-slate-300">
              {busy ?? (editing ? '儲存變更' : '儲存到「我的家具」')}
            </button>
          </aside>
        </div>
      </div>
    </div>
  )
}
