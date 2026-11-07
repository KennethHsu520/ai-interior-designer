'use client'

import { allWallsConfirmed, useRoomStore } from '@/store/useRoomStore'
import { bbox, cornerAngles, formatAngle, isRectangle, MIN_WALL, scaleFloor, validateFloor, validateHeight, wallLengths } from '@/lib/geometry'
import { locksOf, solveFloor } from '@/lib/floorSolver'
import { itemTypeInfo } from '@/types/room'
import NumberField from '@/components/ui/NumberField'

export default function RoomSizePanel() {
  const room = useRoomStore((s) => s.room)
  const setSize = useRoomStore((s) => s.setSize)
  const setHeight = useRoomStore((s) => s.setHeight)
  const setName = useRoomStore((s) => s.setName)
  const resetRect = useRoomStore((s) => s.resetRect)
  const selectWall = useRoomStore((s) => s.selectWall)
  const setFloorEditorOpen = useRoomStore((s) => s.setFloorEditorOpen)
  const removeCeilingItem = useRoomStore((s) => s.removeCeilingItem)
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
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-slate-800">步驟一：輸入房間尺寸</h2>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-slate-500">房間名稱</span>
          <input
            value={room.name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-300"
          />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <NumberField label={rect ? '長（左右）' : '外框長'} value={b.width} validate={checkWidth} onCommit={(v) => setSize(v, b.depth)} />
          <NumberField label={rect ? '寬（前後）' : '外框寬'} value={b.depth} validate={checkDepth} onCommit={(v) => setSize(b.width, v)} />
          <NumberField label="高度" value={room.height} validate={validateHeight} onCommit={setHeight} />
        </div>
        {!rect && <p className="text-[11px] text-slate-500">目前是自訂格局，修改長寬會等比例縮放整個格局。</p>}
        <div className="flex gap-2">
          <button
            onClick={() => setFloorEditorOpen(true)}
            className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
          >
            ✏️ 自訂格局（L 型等）
          </button>
          {!rect && (
            <button
              onClick={() => resetRect(Math.max(b.width, 1), Math.max(b.depth, 1))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              改回矩形
            </button>
          )}
        </div>
        {errors.length > 0 && (
          <ul className="rounded-lg bg-red-50 p-2 text-xs text-red-600">
            {errors.map((e) => (
              <li key={e}>⚠️ {e}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-bold text-slate-800">步驟二：逐面牆拍照與確認</h2>
          <span className="text-xs text-slate-500">
            {confirmedCount}/{room.walls.length}
          </span>
        </div>
        <p className="text-xs text-slate-500">在 3D 畫面點一面牆，或從下面選擇。長度可直接在這裡修改。</p>
        <ul className="flex flex-col gap-1.5">
          {room.walls.map((w, i) => (
            <li key={w.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:border-sky-300 hover:bg-sky-50">
              <button onClick={() => selectWall(i)} className="shrink-0 text-left text-sm font-medium text-slate-700">
                牆 {i + 1}
              </button>
              <div className="w-24 shrink-0">
                <NumberField
                  key={`${w.id}-${room.floor.length}`}
                  compact
                  value={lengths[i]}
                  disabled={locks.lengths[i]}
                  suffix={locks.lengths[i] ? '🔒' : 'm'}
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
              <span className="shrink-0 text-[11px] tabular-nums text-slate-400" title={`牆 ${i + 1} 與牆 ${((i + 1) % room.walls.length) + 1} 的夾角`}>
                ∠{formatAngle(angles[(i + 1) % angles.length])}
              </span>
              <button onClick={() => selectWall(i)} className="flex flex-1 items-center justify-end gap-1.5 text-xs">
                {w.photoUrl && <span title="已拍照">📷</span>}
                {w.items.length > 0 && <span className="text-slate-500">{w.items.length} 件</span>}
                {w.confirmed ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">已確認</span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">待確認</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {room.ceilingItems.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-slate-800">天花板物件</h2>
          <ul className="flex flex-col gap-1">
            {room.ceilingItems.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: itemTypeInfo(c.type).color }} />
                  {itemTypeInfo(c.type).label}・{c.label}
                </span>
                <button onClick={() => removeCeilingItem(c.id)} className="text-slate-400 hover:text-red-500">
                  刪除
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-dashed border-slate-300 p-3">
        <button
          disabled={!ready}
          onClick={() => setStage('furniture')}
          className="w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          格局完成，開始擺放家具 →
        </button>
        {!ready && <p className="mt-2 text-center text-[11px] text-slate-500">所有牆面都確認後才能進入階段二</p>}
      </section>
    </div>
  )
}
