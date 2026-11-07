'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { allWallsConfirmed, useRoomStore } from '@/store/useRoomStore'
import { validateFloor } from '@/lib/geometry'
import { CATALOG_MAP } from '@/lib/catalog'
import { exportRoom, importRoom } from '@/lib/io'
import RoomScene from './scene/RoomScene'
import ViewControls from './scene/ViewControls'
import { screenToFloor } from './scene/bridge'
import RoomSizePanel from './panels/RoomSizePanel'
import FloorPlanEditor from './panels/FloorPlanEditor'
import WallPhotoPanel from './panels/WallPhotoPanel'
import FurnitureCatalog, { addToRoom } from './panels/FurnitureCatalog'
import ChatPanel from './panels/ChatPanel'
import SelectedFurniturePanel from './panels/SelectedFurniturePanel'

export default function Editor() {
  const stage = useRoomStore((s) => s.stage)
  const setStage = useRoomStore((s) => s.setStage)
  const room = useRoomStore((s) => s.room)
  const selectedWall = useRoomStore((s) => s.selectedWall)
  const resetAll = useRoomStore((s) => s.resetAll)
  const [tab, setTab] = useState<'catalog' | 'chat'>('catalog')
  const [menu, setMenu] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const importRef = useRef<HTMLInputElement>(null)

  const ready = allWallsConfirmed(room) && validateFloor(room.floor).length === 0
  const confirmed = room.walls.filter((w) => w.confirmed).length

  const flash = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(null), 3000)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    if (!CATALOG_MAP.has(id) || stage !== 'furniture') return
    const p = screenToFloor(e.clientX, e.clientY)
    addToRoom(id, p?.x, p?.z)
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-slate-100 text-slate-800">
      <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 sm:px-4">
        <span className="hidden text-base font-black tracking-tight sm:block">
          🏠 AI<span className="text-sky-600">室內設計師</span>
        </span>
        <span className="text-base font-black sm:hidden">🏠</span>
        <nav className="mx-auto flex rounded-xl bg-slate-100 p-1 text-xs font-semibold sm:text-sm">
          <button
            onClick={() => setStage('room')}
            className={`rounded-lg px-3 py-1.5 ${stage === 'room' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}
          >
            ① 建立房間
            <span className="ml-1 text-[10px] font-normal tabular-nums text-slate-400">
              {confirmed}/{room.walls.length}
            </span>
          </button>
          <button
            disabled={!ready}
            onClick={() => setStage('furniture')}
            title={ready ? '' : '請先確認所有牆面'}
            className={`rounded-lg px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40 ${stage === 'furniture' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}
          >
            ② 擺放家具 {!ready && '🔒'}
          </button>
        </nav>
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50" aria-label="選單">
            ☰
          </button>
          {menu && (
            <div
              className="absolute right-0 top-11 z-30 flex w-56 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-sm shadow-xl"
              onMouseLeave={() => {
                setMenu(false)
                setConfirmReset(false)
              }}
            >
              <Link href="/plan" className="border-b border-slate-100 px-4 py-2.5 font-semibold text-sky-700 hover:bg-sky-50">
                📐 輸出設計圖（PDF／CAD）
              </Link>
              <button
                className="px-4 py-2.5 text-left hover:bg-slate-50"
                onClick={async () => {
                  setMenu(false)
                  await exportRoom()
                  flash('已匯出房間 JSON')
                }}
              >
                ⬇️ 匯出房間 JSON
              </button>
              <button
                className="px-4 py-2.5 text-left hover:bg-slate-50"
                onClick={() => {
                  setMenu(false)
                  importRef.current?.click()
                }}
              >
                ⬆️ 匯入房間 JSON
              </button>
              <Link href="/licenses" className="px-4 py-2.5 hover:bg-slate-50">
                📜 素材來源與授權
              </Link>
              {confirmReset ? (
                <div className="flex flex-col gap-2 border-t border-slate-100 bg-red-50 px-4 py-2.5 text-xs text-red-700">
                  <span>確定清除目前房間與家具？無法復原，建議先匯出 JSON 備份。</span>
                  <span className="flex gap-2">
                    <button className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600" onClick={() => setConfirmReset(false)}>
                      取消
                    </button>
                    <button
                      className="flex-1 rounded-md bg-red-600 px-2 py-1 font-semibold text-white"
                      onClick={() => {
                        setConfirmReset(false)
                        setMenu(false)
                        resetAll()
                      }}
                    >
                      清除
                    </button>
                  </span>
                </div>
              ) : (
                <button className="border-t border-slate-100 px-4 py-2.5 text-left text-red-600 hover:bg-red-50" onClick={() => setConfirmReset(true)}>
                  🗑️ 重新開始
                </button>
              )}
            </div>
          )}
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              try {
                await importRoom(file)
                flash('匯入成功')
              } catch (err) {
                flash(err instanceof Error ? err.message : '匯入失敗')
              }
            }}
          />
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-0 flex-1" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <RoomScene />
          <ViewControls />
          <div className="pointer-events-none absolute left-3 top-3 max-w-[70%] rounded-lg bg-white/85 px-3 py-1.5 text-[11px] text-slate-600 shadow backdrop-blur">
            {stage === 'room'
              ? selectedWall === null
                ? '左鍵旋轉・右鍵平移・滾輪縮放・WASD 移動・點一面牆開始拍照'
                : `正在編輯牆 ${selectedWall + 1}・可直接拖曳牆上的方塊`
              : '拖曳家具移動（會停在牆邊）・右鍵平移視角・WASD 移動・紅色代表重疊或擋門'}
          </div>
          <button
            onClick={() => setPanelOpen((o) => !o)}
            className="absolute bottom-3 right-3 rounded-full bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white shadow md:hidden"
          >
            {panelOpen ? '收起面板 ▾' : '打開面板 ▴'}
          </button>
        </div>

        <aside
          className={`z-10 flex shrink-0 flex-col border-slate-200 bg-white md:h-auto md:w-[380px] md:border-l ${
            panelOpen ? 'h-[48dvh]' : 'h-0'
          } border-t md:border-t-0`}
        >
          {stage === 'furniture' && (
            <div className="flex shrink-0 border-b border-slate-200 text-sm font-semibold">
              <button onClick={() => setTab('catalog')} className={`flex-1 py-2.5 ${tab === 'catalog' ? 'border-b-2 border-sky-600 text-sky-700' : 'text-slate-500'}`}>
                🪑 家具庫
              </button>
              <button onClick={() => setTab('chat')} className={`flex-1 py-2.5 ${tab === 'chat' ? 'border-b-2 border-violet-600 text-violet-700' : 'text-slate-500'}`}>
                💬 跟 AI 討論
              </button>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
            {stage === 'room' ? (
              selectedWall === null ? <RoomSizePanel /> : <WallPhotoPanel />
            ) : (
              <div className="flex flex-col gap-3">
                <SelectedFurniturePanel />
                {tab === 'catalog' ? <FurnitureCatalog /> : <ChatPanel />}
              </div>
            )}
            <div className="h-4" />
          </div>
        </aside>
      </main>

      <FloorPlanEditor />
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>
      )}
    </div>
  )
}
