'use client'

import { useEffect, useRef, useState } from 'react'
import { useRoomStore, useSelectedWall } from '@/store/useRoomStore'
import { bbox, clampItem, uid, wallPoint, wallSegment } from '@/lib/geometry'
import { compressImage, deletePhoto, loadPhoto, savePhoto } from '@/lib/image'
import { itemTypeInfo, WALL_ITEM_TYPES, type WallItem, type WallItemType } from '@/types/room'
import NumberField from '@/components/ui/NumberField'
import WallElevation from './WallElevation'

type Detection = {
  type: WallItemType
  label: string
  location: 'wall' | 'ceiling'
  x0: number
  x1: number
  y0: number
  y1: number
  confidence: number
}

const DEFAULT_SIZE: Record<WallItemType, { w: number; h: number; e: number }> = {
  door: { w: 0.9, h: 2.1, e: 0 },
  window: { w: 1.2, h: 1.2, e: 0.9 },
  switch: { w: 0.08, h: 0.12, e: 1.2 },
  outlet: { w: 0.08, h: 0.12, e: 0.3 },
  light: { w: 0.3, h: 0.15, e: 2.2 },
  air_conditioner: { w: 0.9, h: 0.3, e: 2.2 },
  furniture: { w: 1.0, h: 0.8, e: 0 },
  other: { w: 0.3, h: 0.3, e: 1.0 },
}

function usePhoto(ref: string | undefined) {
  const [state, setState] = useState<{ ref: string | undefined; url: string | null }>({ ref: undefined, url: null })
  useEffect(() => {
    let alive = true
    loadPhoto(ref).then((url) => {
      if (alive) setState({ ref, url })
    })
    return () => {
      alive = false
    }
  }, [ref])
  return state.ref === ref ? state.url : null
}

export default function WallPhotoPanel() {
  const wall = useSelectedWall()
  const room = useRoomStore((s) => s.room)
  const index = useRoomStore((s) => s.selectedWall)
  const selectWall = useRoomStore((s) => s.selectWall)
  const selectedItemId = useRoomStore((s) => s.selectedItemId)
  const selectItem = useRoomStore((s) => s.selectItem)
  const setWallPhoto = useRoomStore((s) => s.setWallPhoto)
  const setPhotoBounds = useRoomStore((s) => s.setPhotoBounds)
  const setWallItems = useRoomStore((s) => s.setWallItems)
  const addItem = useRoomStore((s) => s.addItem)
  const updateItem = useRoomStore((s) => s.updateItem)
  const removeItem = useRoomStore((s) => s.removeItem)
  const confirmWall = useRoomStore((s) => s.confirmWall)
  const addCeilingItems = useRoomStore((s) => s.addCeilingItems)
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<null | 'photo' | 'ai'>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string } | null>(null)
  const [newType, setNewType] = useState<WallItemType>('outlet')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const photo = usePhoto(wall?.photoUrl)

  if (!wall || index === null) return null
  const seg = wallSegment(room.floor, index)
  const length = seg.length
  const height = room.height
  const n = room.walls.length

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy('photo')
    setMessage(null)
    setConfirmDelete(false)
    let dataUrl: string
    try {
      dataUrl = await compressImage(file)
    } catch (e) {
      console.error(e)
      setMessage({
        kind: 'error',
        text: `無法讀取這個檔案（${file.name}），檔案可能已損毀或不是圖片。`,
      })
      setBusy(null)
      if (cameraInput.current) cameraInput.current.value = ''
      if (galleryInput.current) galleryInput.current.value = ''
      return
    }
    try {
      const old = wall.photoUrl
      const ref = await savePhoto(`wall_${wall.id}_${Date.now()}`, dataUrl)
      setWallPhoto(index, ref)
      await deletePhoto(old)
      setMessage({ kind: 'ok', text: '照片已儲存，可以按「AI 辨識」了。' })
    } catch (e) {
      console.error(e)
      setMessage({ kind: 'error', text: '照片儲存失敗，可能是瀏覽器儲存空間不足或停用了網站資料。' })
    } finally {
      setBusy(null)
      if (cameraInput.current) cameraInput.current.value = ''
      if (galleryInput.current) galleryInput.current.value = ''
    }
  }

  const removePhoto = async () => {
    if (!wall.photoUrl) return
    const old = wall.photoUrl
    setConfirmDelete(false)
    setWallPhoto(index, undefined)
    await deletePhoto(old)
    setMessage({ kind: 'ok', text: '照片已刪除，可以重新拍照或上傳。' })
  }

  const analyze = async () => {
    if (!photo) return
    setBusy('ai')
    setMessage(null)
    try {
      const res = await fetch('/api/analyze-wall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photo, wallLength: length, roomHeight: height }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '辨識失敗')
      const dets = data.items as Detection[]
      const wallItems: WallItem[] = dets
        .filter((d) => d.location === 'wall')
        .map((d) =>
          clampItem(
            {
              id: uid('item'),
              type: d.type,
              label: d.label,
              offset: d.x0 * length,
              width: (d.x1 - d.x0) * length,
              elevation: (1 - d.y1) * height,
              height: (d.y1 - d.y0) * height,
              confidence: d.confidence,
              confirmed: false,
            },
            length,
            height,
          ),
        )
      const b = bbox(room.floor)
      const inset = Math.min(1.2, Math.min(b.width, b.depth) / 2)
      const ceiling: WallItem[] = dets
        .filter((d) => d.location === 'ceiling')
        .map((d) => {
          const p = wallPoint(room.floor, index, ((d.x0 + d.x1) / 2) * length, inset)
          return {
            id: uid('ceil'),
            type: d.type,
            label: d.label,
            offset: p.x,
            elevation: p.z,
            width: Math.max(0.2, (d.x1 - d.x0) * length),
            height: Math.max(0.2, (d.x1 - d.x0) * length * 0.5),
            confidence: d.confidence,
            confirmed: false,
          }
        })
      const kept = wall.items.filter((it) => it.confirmed)
      setWallItems(index, [...kept, ...wallItems])
      if (data.wall) setPhotoBounds(index, data.wall)
      if (ceiling.length) addCeilingItems(ceiling)
      const text = `辨識到 ${wallItems.length} 件牆面物件${ceiling.length ? `、${ceiling.length} 件天花板物件` : ''}，請逐一檢查位置。`
      setMessage(
        data.mock
          ? { kind: 'warn', text: `示範模式（尚未設定 AI_API_KEY），以下是假資料。${text}` }
          : { kind: 'ok', text },
      )
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : '辨識失敗' })
    } finally {
      setBusy(null)
    }
  }

  const addManual = () => {
    const d = DEFAULT_SIZE[newType]
    const item = clampItem(
      {
        id: uid('item'),
        type: newType,
        label: itemTypeInfo(newType).label,
        offset: (length - d.w) / 2,
        width: d.w,
        elevation: d.e,
        height: d.h,
        confirmed: true,
      },
      length,
      height,
    )
    addItem(index, item)
  }

  const allConfirmed = wall.items.every((it) => it.confirmed)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => selectWall(null)} className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">
          ← 返回
        </button>
        <div className="text-center">
          <h2 className="text-base font-bold text-slate-800">牆 {index + 1}</h2>
          <p className="text-xs tabular-nums text-slate-500">
            長 {length.toFixed(2)} m・高 {height.toFixed(2)} m
          </p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => selectWall((index - 1 + n) % n)} className="rounded-lg border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50" aria-label="上一面牆">
            ‹
          </button>
          <button onClick={() => selectWall((index + 1) % n)} className="rounded-lg border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50" aria-label="下一面牆">
            ›
          </button>
        </div>
      </div>

      <section className="flex flex-col gap-2 rounded-xl bg-sky-50 p-3">
        <p className="text-xs leading-relaxed text-sky-800">
          📐 站在房間另一側，<b>盡量拍到整面牆</b>，<b>左右兩端的牆角都要入鏡</b>，手機保持水平。
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={!!busy}
            onClick={() => cameraInput.current?.click()}
            className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            📷 拍照
          </button>
          <button
            disabled={!!busy}
            onClick={() => galleryInput.current?.click()}
            className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
          >
            🖼️ {wall.photoUrl ? '換一張' : '上傳照片'}
          </button>
        </div>
        {wall.photoUrl && !confirmDelete && (
          <button
            disabled={!!busy}
            onClick={() => setConfirmDelete(true)}
            className="self-end text-xs font-medium text-red-500 hover:text-red-600 hover:underline disabled:opacity-50"
          >
            🗑️ 刪除這張照片
          </button>
        )}
        {wall.photoUrl && confirmDelete && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">
            <span>確定刪除照片？已標記的物件會保留。</span>
            <span className="flex shrink-0 gap-1.5">
              <button onClick={() => setConfirmDelete(false)} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:bg-slate-50">
                取消
              </button>
              <button onClick={removePhoto} className="rounded-md bg-red-500 px-2 py-1 font-semibold text-white hover:bg-red-600">
                刪除
              </button>
            </span>
          </div>
        )}
        <input ref={cameraInput} type="file" accept="image/*,.heic,.heif" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <input ref={galleryInput} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <button
          disabled={!photo || !!busy}
          onClick={analyze}
          className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy === 'ai' ? 'AI 辨識中…（約 10～30 秒）' : busy === 'photo' ? '處理照片中…' : '✨ AI 辨識門窗插座'}
        </button>
        {message && (
          <p
            className={`rounded-lg px-2 py-1.5 text-xs ${
              message.kind === 'ok' ? 'bg-emerald-100 text-emerald-800' : message.kind === 'warn' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'
            }`}
          >
            {message.text}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-slate-800">牆面立面圖</h3>
        <p className="text-[11px] text-slate-500">拖曳方框調整位置，選取後拖曳右下角圓點調整大小。也可以在 3D 畫面直接拖曳。</p>
        <WallElevation wallIndex={index} length={length} height={height} items={wall.items} photo={photo} bounds={wall.photoBounds} />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">物件清單（{wall.items.length}）</h3>
          <div className="flex items-center gap-1">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as WallItemType)}
              className="rounded-lg border border-slate-200 px-1.5 py-1 text-xs"
            >
              {WALL_ITEM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <button onClick={addManual} className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700">
              ＋ 新增
            </button>
          </div>
        </div>
        {wall.items.length === 0 && <p className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-400">這面牆目前沒有物件</p>}
        <ul className="flex flex-col gap-1.5">
          {wall.items.map((it) => {
            const sel = it.id === selectedItemId
            const info = itemTypeInfo(it.type)
            return (
              <li key={it.id} className={`rounded-lg border ${sel ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: info.color }} />
                  <button onClick={() => selectItem(sel ? null : it.id)} className="min-w-0 flex-1 truncate text-left text-sm text-slate-700">
                    {info.label}・{it.label}
                    {it.confidence !== undefined && <span className="ml-1 text-[10px] text-slate-400">{Math.round(it.confidence * 100)}%</span>}
                  </button>
                  <label className="flex shrink-0 items-center gap-1 text-[11px] text-slate-500">
                    <input
                      type="checkbox"
                      checked={it.confirmed}
                      onChange={(e) => updateItem(index, it.id, { confirmed: e.target.checked })}
                      className="accent-emerald-600"
                    />
                    確認
                  </label>
                  <button onClick={() => removeItem(index, it.id)} className="shrink-0 px-1 text-xs text-slate-400 hover:text-red-500" aria-label="刪除">
                    ✕
                  </button>
                </div>
                {sel && (
                  <div className="flex flex-col gap-2 border-t border-amber-200 p-2">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1 text-[11px]">
                        <span className="font-medium text-slate-500">類型</span>
                        <select
                          value={it.type}
                          onChange={(e) => updateItem(index, it.id, { type: e.target.value as WallItemType })}
                          className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs"
                        >
                          {WALL_ITEM_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-[11px]">
                        <span className="font-medium text-slate-500">名稱</span>
                        <input
                          value={it.label}
                          onChange={(e) => updateItem(index, it.id, { label: e.target.value })}
                          className="rounded-lg border border-slate-200 px-1.5 py-1 text-xs"
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      <NumberField compact label="距牆起點" value={it.offset} onCommit={(v) => updateItem(index, it.id, { offset: v })} />
                      <NumberField compact label="離地" value={it.elevation} onCommit={(v) => updateItem(index, it.id, { elevation: v })} />
                      <NumberField compact label="寬" value={it.width} onCommit={(v) => updateItem(index, it.id, { width: v })} validate={(v) => (v <= 0 ? '需大於 0' : null)} />
                      <NumberField compact label="高" value={it.height} onCommit={(v) => updateItem(index, it.id, { height: v })} validate={(v) => (v <= 0 ? '需大於 0' : null)} />
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        {wall.confirmed ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-emerald-700">✓ 這面牆已確認</span>
            <div className="flex gap-2">
              <button onClick={() => confirmWall(index, false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                取消確認
              </button>
              <button onClick={() => selectWall((index + 1) % n)} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white">
                下一面牆 →
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              confirmWall(index, true)
              const next = room.walls.findIndex((w, i) => i !== index && !w.confirmed)
              if (next >= 0) selectWall(next)
            }}
            className="w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
          >
            {wall.items.length === 0 ? '這面牆沒有東西，確認' : allConfirmed ? '確認這面牆 ✓' : `全部確認（${wall.items.filter((i) => !i.confirmed).length} 件尚未勾選）`}
          </button>
        )}
      </section>
    </div>
  )
}
