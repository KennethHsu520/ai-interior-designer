'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { compressImage, deletePhoto, loadPhoto, savePhoto } from '@/lib/image'
import { extractColors } from '@/lib/colorExtract'
import { KINDS, rolesOf, roleLabel, SWATCHES, type Role } from '@/lib/procedural'
import { CATEGORY_ICON } from '@/lib/catalog'
import { CUSTOM_PREFIX, defaultColors, kindOf, saveCustomFurniture, type CustomFurniture } from '@/lib/customFurniture'
import { PROCEDURAL_CATALOG } from '@/lib/procedural'
import { getThumbnail } from '@/lib/thumbnails'
import { ProceduralModel } from '@/components/scene/FurnitureMesh'
import type { CatalogItem } from '@/types/room'
import { buildMeshObject, RECON_DOWNLOAD, reconSupported, runRecon, STAGE_LABEL, type ReconMesh, type ReconProgress } from '@/lib/recon/client'
import { objectToGlbDataUrl, resizeStoredModel, resolveModelUrl } from '@/lib/modelUrl'

type ReconState =
  | { status: 'checking' }
  | { status: 'unsupported'; reason: string }
  | { status: 'idle' }
  | { status: 'consent' }
  | { status: 'working'; progress: ReconProgress }
  | { status: 'failed'; message: string }

const RECON_CONSENT_KEY = 'recon-model-consent'

function StoredPreview({ file, size }: { file: string; size: { width: number; depth: number; height: number } }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    resolveModelUrl(file).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [file])
  if (!url) return null
  return <StoredPreviewInner url={url} size={size} />
}

function StoredPreviewInner({ url, size }: { url: string; size: { width: number; depth: number; height: number } }) {
  const { scene } = useGLTF(url)
  const obj = useMemo(() => {
    const c = scene.clone(true)
    const box = new THREE.Box3().setFromObject(c)
    const ext = box.getSize(new THREE.Vector3())
    const inner = new THREE.Group()
    inner.add(c)
    inner.position.set(-(box.min.x + ext.x / 2), -box.min.y, -(box.min.z + ext.z / 2))
    const holder = new THREE.Group()
    holder.add(inner)
    holder.scale.set(size.width / (ext.x || 1), size.height / (ext.y || 1), size.depth / (ext.z || 1))
    return holder
  }, [scene, size])
  return <primitive object={obj} />
}

function GeneratedPreview({ mesh, size }: { mesh: ReconMesh; size: { width: number; depth: number; height: number } }) {
  const key = `${size.width}|${size.depth}|${size.height}`
  const obj = useMemo(() => {
    const [w, d, h] = key.split('|').map(Number)
    return buildMeshObject(mesh, { width: w, depth: d, height: h })
  }, [mesh, key])
  useEffect(
    () => () => {
      obj.geometry.dispose()
      ;(obj.material as THREE.Material).dispose()
    },
    [obj],
  )
  return <primitive object={obj} />
}

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
  const [recon, setRecon] = useState<ReconState>({ status: 'checking' })
  const [reconMesh, setReconMesh] = useState<ReconMesh | null>(null)
  const [useGenerated, setUseGenerated] = useState(!!editing?.modelRef)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let alive = true
    reconSupported().then((r) => alive && setRecon(r.ok ? { status: 'idle' } : { status: 'unsupported', reason: r.reason ?? '此裝置不支援' }))
    return () => {
      alive = false
      abortRef.current?.abort()
    }
  }, [])

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
  const canSave = !!name.trim() && sizeOk && !busy && recon.status !== 'working'
  const generatedAvailable = !!reconMesh || !!editing?.modelRef

  const startRecon = async () => {
    if (!photo) return
    let consent = false
    try {
      consent = localStorage.getItem(RECON_CONSENT_KEY) === '1'
    } catch {}
    if (!consent) {
      setRecon({ status: 'consent' })
      return
    }
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setRecon({ status: 'working', progress: { stage: 'download-model', percent: 0 } })
    try {
      const mesh = await runRecon(photo, (progress) => setRecon({ status: 'working', progress }), ctrl.signal)
      setReconMesh(mesh)
      setUseGenerated(true)
      setRecon({ status: 'idle' })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') setRecon({ status: 'idle' })
      else setRecon({ status: 'failed', message: e instanceof Error ? e.message : '生成失敗' })
    } finally {
      abortRef.current = null
    }
  }

  const save = async () => {
    if (!canSave) return
    setBusy('儲存中…')
    setError(null)
    try {
      const id = editing?.id ?? `${CUSTOM_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
      let photoRef = editing?.photoRef
      if (photo && photoChanged) photoRef = await savePhoto(`${id}_photo_${Date.now()}`, photo)
      const finalSize = { width: Math.round(size.width * 100) / 100, depth: Math.round(size.depth * 100) / 100, height: Math.round(size.height * 100) / 100 }
      let modelRef: string | undefined
      if (useGenerated) {
        const sameSize = editing && editing.size.width === finalSize.width && editing.size.depth === finalSize.depth && editing.size.height === finalSize.height
        let glb: string | null = null
        if (reconMesh) glb = await objectToGlbDataUrl(buildMeshObject(reconMesh, finalSize))
        else if (editing?.modelRef && !sameSize) glb = await resizeStoredModel(editing.modelRef, finalSize)
        modelRef = glb ? await savePhoto(`${id}_model_${Date.now()}`, glb) : editing?.modelRef
      }
      if (editing?.modelRef && editing.modelRef !== modelRef) await deletePhoto(editing.modelRef)
      const item: CustomFurniture = {
        id,
        name: name.trim(),
        kind,
        size: finalSize,
        colors,
        photoRef,
        modelRef,
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

            {recon.status !== 'unsupported' && recon.status !== 'checking' && (
              <section className="flex flex-col gap-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-violet-900">🧪 實驗：從照片生成 3D 形狀</h3>
                  <span className="rounded-full bg-violet-200 px-2 py-0.5 text-[10px] font-semibold text-violet-800">實驗功能</span>
                </div>
                <p className="text-[11px] leading-relaxed text-violet-900/80">形狀僅供參考，尺寸以你在 ③ 輸入的為準。全部在你的電腦上用顯示卡運算，照片不會上傳。背景越單純、家具越完整入鏡，效果越好。</p>
                {recon.status === 'consent' && (
                  <div className="flex flex-col gap-2 rounded-lg bg-white p-2 text-[11px] text-slate-700">
                    <p>第一次使用需要下載 3D 生成模型（{RECON_DOWNLOAD}），下載後會存在瀏覽器，下次不用再下載。建議使用 Wi-Fi。</p>
                    <div className="flex gap-2">
                      <button onClick={() => setRecon({ status: 'idle' })} className="rounded-md border border-slate-200 px-3 py-1 font-semibold text-slate-600">
                        先不要
                      </button>
                      <button
                        onClick={() => {
                          try {
                            localStorage.setItem(RECON_CONSENT_KEY, '1')
                          } catch {}
                          setRecon({ status: 'idle' })
                          setTimeout(startRecon, 0)
                        }}
                        className="flex-1 rounded-md bg-violet-600 px-3 py-1 font-bold text-white hover:bg-violet-500"
                      >
                        下載並開始生成
                      </button>
                    </div>
                  </div>
                )}
                {recon.status === 'working' && (
                  <div className="flex flex-col gap-1.5 text-[11px] text-violet-900">
                    <div className="flex items-center justify-between">
                      <span>
                        {STAGE_LABEL[recon.progress.stage]}… {Math.round(recon.progress.percent)}%
                      </span>
                      <button onClick={() => abortRef.current?.abort()} className="rounded-md border border-violet-300 bg-white px-2 py-0.5 font-semibold text-violet-700 hover:bg-violet-100">
                        取消
                      </button>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-violet-100">
                      <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${recon.progress.percent}%` }} />
                    </div>
                  </div>
                )}
                {recon.status === 'failed' && <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">沒有成功：{recon.message}。已改用下面的參數化家具，你可以換一張照片再試。</p>}
                {(recon.status === 'idle' || recon.status === 'failed') && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      disabled={!photo || !!busy}
                      onClick={startRecon}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-500 disabled:bg-slate-300"
                    >
                      {reconMesh ? '重新生成' : '✨ 從照片生成形狀'}
                    </button>
                    {!photo && <span className="text-[11px] text-slate-500">請先在 ① 拍照或上傳照片</span>}
                    {generatedAvailable && (
                      <label className="ml-auto flex items-center gap-1.5 text-[11px] text-violet-900">
                        <input type="checkbox" checked={useGenerated} onChange={(e) => setUseGenerated(e.target.checked)} className="accent-violet-600" />
                        使用生成的形狀
                      </label>
                    )}
                  </div>
                )}
              </section>
            )}

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
              {useGenerated && generatedAvailable && <p className="text-[11px] text-slate-500">目前使用生成的 3D 形狀，顏色直接來自照片；改用參數化家具時才會套用下面的顏色。</p>}
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
                  {useGenerated && reconMesh ? (
                    <GeneratedPreview mesh={reconMesh} size={size} />
                  ) : useGenerated && editing?.modelRef ? (
                    <StoredPreview file={editing.modelRef} size={size} />
                  ) : (
                    <ProceduralModel kind={kind} size={size} colors={colors} />
                  )}
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
