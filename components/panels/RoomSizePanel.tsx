'use client'

import { ArrowRight, Camera, Info, Lock, PencilRuler } from 'lucide-react'
import { allWallsConfirmed, useRoomStore } from '@/store/useRoomStore'
import { bbox, cornerAngles, formatAngle, isRectangle, MIN_WALL, scaleFloor, validateFloor, validateHeight, wallLengths } from '@/lib/geometry'
import { locksOf, solveFloor } from '@/lib/floorSolver'
import { itemTypeInfo } from '@/types/room'
import NumberField from '@/components/ui/NumberField'
import Button from '@/components/ui/Button'
import { ICON, helpTextClass, inputClass, labelClass, sectionTitleClass } from '@/components/ui/fields'

export default function RoomSizePanel() {
  const room = useRoomStore((s) => s.room)
  const setSize = useRoomStore((s) => s.setSize)
  const setHeight = useRoomStore((s) => s.setHeight)
  const setName = useRoomStore((s) => s.setName)
  const resetRect = useRoomStore((s) => s.resetRect)
  const selectWall = useRoomStore((s) => s.selectWall)
  const setFloorEditorOpen = useRoomStore((s) => s.setFloorEditorOpen)
  const removeCeilingItem = useRoomStore((s) => s.removeCeilingItem)
  const updateCeilingItem = useRoomStore((s) => s.updateCeilingItem)
  const setStage = useRoomStore((s) => s.setStage)
  const setFloor = useRoomStore((s) => s.setFloor)

  const b = bbox(room.floor)
  const rect = isRectangle(room.floor)
  const lengths = wallLengths(room.floor)
  const angles = cornerAngles(room.floor)
  const locks = locksOf(room.walls, room.floor.length)
  const solveLength = (i: number, v: number) => solveFloor(room.floor, { kind: 'length', index: i, value: v }, locks)
  const errors = validateFloor(room.floor)
  const confirmedCount = room.walls.filter((w) => w.confirmed).length
  const ready = allWallsConfirmed(room) && errors.length === 0

  const checkWidth = (v: number) => {
    if (v <= MIN_WALL) return '需大於 0'
    if (v > 30) return '太大了'
    const errs = validateFloor(scaleFloor(room.floor, v, b.depth))
    return errs[0] ?? null
  }
  const checkDepth = (v: number) => {
    if (v <= MIN_WALL) return '需大於 0'
    if (v > 30) return '太大了'
    const errs = validateFloor(scaleFloor(room.floor, b.width, v))
    return errs[0] ?? null
  }

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-brand-600">步驟一</span>
          <h2 className={sectionTitleClass}>輸入房間尺寸</h2>
        </div>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>房間名稱</span>
          <input value={room.name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <NumberField label={rect ? '長（左右）' : '外框長'} value={b.width} validate={checkWidth} onCommit={(v) => setSize(v, b.depth)} />
          <NumberField label={rect ? '寬（前後）' : '外框寬'} value={b.depth} validate={checkDepth} onCommit={(v) => setSize(b.width, v)} />
          <NumberField label="高度" value={room.height} validate={validateHeight} onCommit={setHeight} />
        </div>
        {!rect && <p className={helpTextClass}>目前是自訂格局，修改長寬會等比例縮放整個格局。</p>}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => setFloorEditorOpen(true)}>
            <PencilRuler {...ICON} />
            自訂格局（L 型等）
          </Button>
          {!rect && (
            <Button variant="ghost" size="sm" onClick={() => resetRect(Math.max(b.width, 1), Math.max(b.depth, 1))}>
              改回矩形
            </Button>
          )}
        </div>
        {errors.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-field bg-danger/10 px-3 py-2 text-xs text-danger">
            {errors.map((e) => (
              <li key={e} className="flex items-start gap-1.5">
                <Info size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                {e}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-brand-600">步驟二</span>
            <h2 className={sectionTitleClass}>逐面牆拍照與確認</h2>
          </div>
          <span className="rounded-pill bg-surface px-2.5 py-0.5 text-xs tabular-nums text-ink-3">
            {confirmedCount}/{room.walls.length}
          </span>
        </div>
        <p className={helpTextClass}>在 3D 畫面點一面牆，或從下面選擇。長度可直接在這裡修改。</p>
        <ul className="flex flex-col gap-2">
          {room.walls.map((w, i) => (
            <li
              key={w.id}
              className="flex items-center gap-2.5 rounded-field border border-line bg-white px-3 py-2 transition-[border-color,box-shadow] duration-200 ease-soft hover:border-brand-300 hover:shadow-card"
            >
              <button onClick={() => selectWall(i)} className="shrink-0 text-left text-sm font-medium text-ink">
                牆 {i + 1}
              </button>
              <div className="w-24 shrink-0">
                <NumberField
                  key={`${w.id}-${room.floor.length}`}
                  compact
                  value={lengths[i]}
                  disabled={locks.lengths[i]}
                  suffix={locks.lengths[i] ? <Lock size={11} strokeWidth={2} aria-label="已鎖定" /> : 'm'}
                  validate={(v) => {
                    const r = solveLength(i, v)
                    return 'error' in r ? r.error : null
                  }}
                  onCommit={(v) => {
                    const r = solveLength(i, v)
                    if ('floor' in r) setFloor(r.floor)
                  }}
                />
              </div>
              <span className="shrink-0 text-[11px] tabular-nums text-ink-4" title={`牆 ${i + 1} 與牆 ${((i + 1) % room.walls.length) + 1} 的夾角`}>
                ∠{formatAngle(angles[(i + 1) % angles.length])}
              </span>
              <button onClick={() => selectWall(i)} className="flex flex-1 items-center justify-end gap-2 text-xs">
                {w.photoUrl && <Camera size={13} strokeWidth={1.75} className="text-ink-4" aria-label="已拍照" />}
                {w.items.length > 0 && <span className="text-ink-3">{w.items.length} 件</span>}
                {w.confirmed ? (
                  <span className="rounded-pill bg-sage-100 px-2 py-0.5 font-medium text-sage-700">已確認</span>
                ) : (
                  <span className="rounded-pill bg-brand-100 px-2 py-0.5 font-medium text-brand-700">待確認</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {room.ceilingItems.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className={sectionTitleClass}>天花板物件</h2>
          <ul className="flex flex-col gap-1.5">
            {room.ceilingItems.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-field bg-surface px-3 py-2 text-xs">
                <span className="flex items-center gap-2 text-ink-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: itemTypeInfo(c.type).color }} />
                  {itemTypeInfo(c.type).label}・{c.label}
                </span>
                <span className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-ink-3">
                    <input type="checkbox" checked={c.confirmed} onChange={(e) => updateCeilingItem(c.id, { confirmed: e.target.checked })} className="accent-brand-500" />
                    已確認
                  </label>
                  <button onClick={() => removeCeilingItem(c.id)} className="text-ink-4 transition-colors hover:text-danger">
                    刪除
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
        <Button disabled={!ready} onClick={() => setStage('furniture')} className="w-full">
          格局完成，開始擺放家具
          <ArrowRight size={16} strokeWidth={2} />
        </Button>
        {!ready && <p className="text-center text-[11px] text-ink-3">所有牆面都確認後才能進入階段二</p>}
      </section>
    </div>
  )
}
