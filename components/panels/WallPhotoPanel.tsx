'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Image as ImageIcon, Info, Plus, Trash, X } from 'lucide-react'
import { useRoomStore, useSelectedWall } from '@/store/useRoomStore'
import { clampItem, uid, wallSegment } from '@/lib/geometry'
import { compressImage, deletePhoto, loadPhoto, savePhoto } from '@/lib/image'
import { DEFAULT_SWING, itemTypeInfo, WALL_ITEM_TYPES, type DoorSwing, type WallItemType } from '@/types/room'
import NumberField from '@/components/ui/NumberField'
import Button from '@/components/ui/Button'
import { ICON, helpTextClass, iconBtnClass, inputSmClass, labelClass, noteClass, selectSmClass, smallBtnClass, smallDarkBtnClass, stickyBarClass, subTitleClass } from '@/components/ui/fields'
import WallElevation from './WallElevation'
import PhotoMarker from './PhotoMarker'

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
  const addItem = useRoomStore((s) => s.addItem)
  const updateItem = useRoomStore((s) => s.updateItem)
  const removeItem = useRoomStore((s) => s.removeItem)
  const confirmWall = useRoomStore((s) => s.confirmWall)
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
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
    setBusy(true)
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
      setBusy(false)
      if (cameraInput.current) cameraInput.current.value = ''
      if (galleryInput.current) galleryInput.current.value = ''
      return
    }
    try {
      const old = wall.photoUrl
      const ref = await savePhoto(`wall_${wall.id}_${Date.now()}`, dataUrl)
      setWallPhoto(index, ref)
      await deletePhoto(old)
      setMessage({ kind: 'ok', text: '照片已儲存。請先拖曳標線標出牆角，再框選門窗插座。' })
    } catch (e) {
      console.error(e)
      setMessage({ kind: 'error', text: '照片儲存失敗，可能是瀏覽器儲存空間不足或停用了網站資料。' })
    } finally {
      setBusy(false)
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
  const pendingCount = wall.items.filter((i) => !i.confirmed).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => selectWall(null)} className="inline-flex h-9 items-center gap-1 rounded-pill px-2 text-sm text-ink-3 transition-colors hover:bg-surface hover:text-ink">
          <ArrowLeft {...ICON} />
          返回
        </button>
        <div className="text-center">
          <h2 className="text-[17px] font-bold tracking-tight text-ink">牆 {index + 1}</h2>
          <p className="text-xs tabular-nums text-ink-3">
            長 {length.toFixed(2)} m・高 {height.toFixed(2)} m
          </p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => selectWall((index - 1 + n) % n)} className={iconBtnClass} aria-label="上一面牆">
            <ChevronLeft {...ICON} />
          </button>
          <button onClick={() => selectWall((index + 1) % n)} className={iconBtnClass} aria-label="下一面牆">
            <ChevronRight {...ICON} />
          </button>
        </div>
      </div>

      <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-2">
          <Info size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
          <span>
            站在房間另一側，<b className="font-medium text-ink">盡量拍到整面牆</b>，<b className="font-medium text-ink">左右兩端的牆角都要入鏡</b>，手機保持水平。
          </span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" disabled={busy} onClick={() => cameraInput.current?.click()}>
            <Camera {...ICON} />
            拍照
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => galleryInput.current?.click()}>
            <ImageIcon {...ICON} />
            {wall.photoUrl ? '換一張' : '上傳照片'}
          </Button>
        </div>
        {wall.photoUrl && !confirmDelete && (
          <button disabled={busy} onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1 self-end text-xs font-medium text-ink-3 transition-colors hover:text-danger disabled:opacity-50">
            <Trash size={13} strokeWidth={1.75} />
            刪除這張照片
          </button>
        )}
        {wall.photoUrl && confirmDelete && (
          <div className="flex items-center justify-between gap-2 rounded-field bg-danger/10 px-3 py-2 text-xs text-danger">
            <span>確定刪除照片？已標記的物件會保留。</span>
            <span className="flex shrink-0 gap-1.5">
              <button onClick={() => setConfirmDelete(false)} className="rounded-pill border border-line bg-white px-2.5 py-1 text-ink-2 hover:bg-surface">
                取消
              </button>
              <button onClick={removePhoto} className="rounded-pill bg-danger px-2.5 py-1 font-medium text-white hover:bg-danger/90">
                刪除
              </button>
            </span>
          </div>
        )}
        <input ref={cameraInput} type="file" accept="image/*,.heic,.heif" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <input ref={galleryInput} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        {busy && <p className="text-xs text-brand-700">處理照片中…</p>}
        {message && <p className={noteClass[message.kind]}>{message.text}</p>}
      </section>

      {photo && wall.photoUrl && (
        <section className="flex flex-col gap-3">
          <h3 className={subTitleClass}>在照片上標記</h3>
          <PhotoMarker key={wall.photoUrl} wallIndex={index} wallId={wall.id} length={length} height={height} items={wall.items} photo={photo} bounds={wall.photoBounds} />
        </section>
      )}

      {photo && wall.photoUrl ? (
        <details className="group rounded-card border border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold text-ink">
            牆面立面圖（真實比例）
            <span className="flex items-center gap-1 text-xs font-normal text-ink-4 group-open:hidden">
              展開
              <ChevronDown size={14} strokeWidth={1.75} />
            </span>
            <span className="hidden items-center gap-1 text-xs font-normal text-ink-4 group-open:flex">
              收起
              <ChevronUp size={14} strokeWidth={1.75} />
            </span>
          </summary>
          <div className="flex flex-col gap-2 px-4 pb-4">
            <p className={helpTextClass}>
              照片中牆面範圍拉成 {length.toFixed(2)} × {height.toFixed(2)} m 的真實比例，可以直接拖曳方框微調。
            </p>
            <WallElevation wallIndex={index} length={length} height={height} items={wall.items} photo={photo} bounds={wall.photoBounds} />
          </div>
        </details>
      ) : (
        <section className="flex flex-col gap-2">
          <h3 className={subTitleClass}>牆面立面圖</h3>
          <p className={helpTextClass}>還沒拍照也可以用下方「新增」手動加物件，再拖曳方框調整位置，選取後拖曳右下角圓點調整大小。</p>
          <WallElevation wallIndex={index} length={length} height={height} items={wall.items} photo={photo} bounds={wall.photoBounds} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className={subTitleClass}>物件清單（{wall.items.length}）</h3>
          <div className="flex items-center gap-1.5">
            <select value={newType} onChange={(e) => setNewType(e.target.value as WallItemType)} className={`${selectSmClass} w-auto`}>
              {WALL_ITEM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <button onClick={addManual} className={smallDarkBtnClass}>
              <Plus size={14} strokeWidth={2} />
              新增
            </button>
          </div>
        </div>
        {wall.items.length === 0 && <p className="rounded-field bg-surface px-3 py-4 text-center text-xs text-ink-4">這面牆目前沒有物件</p>}
        <ul className="flex flex-col gap-2">
          {wall.items.map((it) => {
            const sel = it.id === selectedItemId
            const info = itemTypeInfo(it.type)
            return (
              <li key={it.id} className={`rounded-field border transition-colors duration-200 ease-soft ${sel ? 'border-brand-300 bg-brand-50' : 'border-line bg-white'}`}>
                <div className="flex items-center gap-2.5 px-3 py-2">
                  <span className="h-3 w-3 shrink-0 rounded-[4px]" style={{ background: info.color }} />
                  <button onClick={() => selectItem(sel ? null : it.id)} className="min-w-0 flex-1 truncate text-left text-sm text-ink">
                    {info.label}・{it.label}
                    {it.confidence !== undefined && <span className="ml-1 text-[10px] text-ink-4">{Math.round(it.confidence * 100)}%</span>}
                  </button>
                  <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-ink-3">
                    <input type="checkbox" checked={it.confirmed} onChange={(e) => updateItem(index, it.id, { confirmed: e.target.checked })} className="accent-brand-500" />
                    確認
                  </label>
                  <button onClick={() => removeItem(index, it.id)} className="shrink-0 rounded-pill p-1 text-ink-4 transition-colors hover:bg-surface hover:text-danger" aria-label="刪除">
                    <X size={14} strokeWidth={1.75} />
                  </button>
                </div>
                {sel && (
                  <div className="flex flex-col gap-2.5 border-t border-brand-200 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1">
                        <span className={labelClass}>類型</span>
                        <select value={it.type} onChange={(e) => updateItem(index, it.id, { type: e.target.value as WallItemType })} className={selectSmClass}>
                          {WALL_ITEM_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className={labelClass}>名稱</span>
                        <input value={it.label} onChange={(e) => updateItem(index, it.id, { label: e.target.value })} className={inputSmClass} />
                      </label>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      <NumberField compact label="距牆起點" value={it.offset} onCommit={(v) => updateItem(index, it.id, { offset: v })} />
                      <NumberField compact label="離地" value={it.elevation} onCommit={(v) => updateItem(index, it.id, { elevation: v })} />
                      <NumberField compact label="寬" value={it.width} onCommit={(v) => updateItem(index, it.id, { width: v })} validate={(v) => (v <= 0 ? '需大於 0' : null)} />
                      <NumberField compact label="高" value={it.height} onCommit={(v) => updateItem(index, it.id, { height: v })} validate={(v) => (v <= 0 ? '需大於 0' : null)} />
                    </div>
                    {it.type === 'door' && <DoorSwingEditor swing={it.swing ?? DEFAULT_SWING} width={it.width} onChange={(sw) => updateItem(index, it.id, { swing: sw })} />}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className={stickyBarClass}>
        {wall.confirmed ? (
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
              <Check size={16} strokeWidth={2} />
              這面牆已確認
            </span>
            <div className="flex gap-2">
              <button onClick={() => confirmWall(index, false)} className={smallBtnClass}>
                取消確認
              </button>
              <button onClick={() => selectWall((index + 1) % n)} className={smallDarkBtnClass}>
                下一面牆
                <ArrowRight size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
        ) : (
          <Button
            className="w-full"
            onClick={() => {
              confirmWall(index, true)
              const next = room.walls.findIndex((w, i) => i !== index && !w.confirmed)
              if (next >= 0) selectWall(next)
            }}
          >
            {wall.items.length === 0 ? '這面牆沒有東西，確認' : allConfirmed ? '確認這面牆' : `全部確認（${pendingCount} 件尚未勾選）`}
            <Check size={16} strokeWidth={2} />
          </Button>
        )}
      </section>
    </div>
  )
}

function DoorSwingEditor({ swing, width, onChange }: { swing: DoorSwing; width: number; onChange: (s: DoorSwing) => void }) {
  const seg = (active: boolean) =>
    `flex-1 rounded-pill px-2 py-1 text-[11px] font-medium transition-[background-color,color,box-shadow] duration-200 ease-soft ${active ? 'bg-white text-ink shadow-card' : 'text-ink-3 hover:text-ink'}`
  const deg = swing.angle
  const t = (deg * Math.PI) / 180
  const dir = swing.hinge === 'start' ? 1 : -1
  const ny = swing.side === 'in' ? 1 : -1
  const hx = swing.hinge === 'start' ? 14 : 66
  const ex = hx + dir * 46 * Math.cos(t)
  const ey = 30 + ny * 46 * Math.sin(t)
  const sx = hx + dir * 46
  const large = deg > 180 ? 1 : 0
  const sweep = (dir === 1) === (ny === 1) ? 1 : 0
  return (
    <div className="flex flex-col gap-3 rounded-field border border-line bg-white p-3">
      <div className="flex items-start gap-3">
        <svg viewBox="0 0 80 80" className="h-20 w-20 shrink-0 rounded-field bg-surface" aria-label="開門示意圖">
          <rect x="0" y="27" width="80" height="6" fill="#d6d3cd" />
          <rect x="14" y="27" width="52" height="6" fill="#fbfaf8" />
          <path d={`M ${sx} 30 A 46 46 0 ${large} ${sweep} ${ex} ${ey} L ${hx} 30 Z`} fill="#c4815f" fillOpacity="0.15" stroke="#c4815f" strokeDasharray="3 2" strokeWidth="1" />
          <line x1={hx} y1="30" x2={ex} y2={ey} stroke="#8e4c31" strokeWidth="3" strokeLinecap="round" />
          <circle cx={hx} cy="30" r="2.5" fill="#1d1d1f" />
          <text x="40" y="76" textAnchor="middle" fontSize="8" fill="#6e6e73">
            房間內
          </text>
          <text x="40" y="10" textAnchor="middle" fontSize="8" fill="#a1a1a6">
            房間外
          </text>
        </svg>
        <div className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] leading-relaxed text-ink-3">
          <span className="text-xs font-bold text-ink">開門方式</span>
          <span>從房間內看這面牆時的方向。陶土色扇形是開門範圍，家具不能放在裡面。</span>
          <span className="tabular-nums">開門半徑 {width.toFixed(2)} m</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className={labelClass}>鉸鏈在</span>
          <div className="flex gap-1 rounded-pill bg-surface p-0.5">
            <button className={seg(swing.hinge === 'start')} onClick={() => onChange({ ...swing, hinge: 'start' })}>
              左側
            </button>
            <button className={seg(swing.hinge === 'end')} onClick={() => onChange({ ...swing, hinge: 'end' })}>
              右側
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className={labelClass}>開向</span>
          <div className="flex gap-1 rounded-pill bg-surface p-0.5">
            <button className={seg(swing.side === 'in')} onClick={() => onChange({ ...swing, side: 'in' })}>
              往內開
            </button>
            <button className={seg(swing.side === 'out')} onClick={() => onChange({ ...swing, side: 'out' })}>
              往外開
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-end gap-2">
        <div className="w-24">
          <NumberField compact label="開啟角度" suffix="°" step={5} digits={0} value={deg} validate={(v) => (v < 30 || v > 180 ? '30～180°' : null)} onCommit={(v) => onChange({ ...swing, angle: v })} />
        </div>
        <div className="flex flex-1 gap-1">
          {[90, 110, 135, 180].map((a) => (
            <button
              key={a}
              onClick={() => onChange({ ...swing, angle: a })}
              className={`h-8 flex-1 rounded-pill border px-1 text-[11px] transition-colors duration-200 ease-soft ${deg === a ? 'border-brand-500 bg-brand-50 font-medium text-brand-700' : 'border-line bg-white text-ink-2 hover:bg-surface'}`}
            >
              {a}°
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
