'use client'

import { useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Download, FileText, Lock, Menu, MessageSquare, ScrollText, Sofa, Trash, Upload } from 'lucide-react'
import { allWallsConfirmed, useRoomStore } from '@/store/useRoomStore'
import { validateFloor } from '@/lib/geometry'
import { CATALOG_MAP } from '@/lib/catalog'
import { useCatalogLoader } from '@/lib/catalogLoader'
import { exportRoom, importRoom } from '@/lib/io'
import Wordmark from '@/components/ui/Wordmark'
import { buttonClass } from '@/components/ui/Button'
import { ICON, iconBtnClass } from '@/components/ui/fields'
import RoomScene from './scene/RoomScene'
import ViewControls from './scene/ViewControls'
import HistoryControls, { useHistoryShortcuts } from './scene/HistoryControls'
import { screenToFloor } from './scene/bridge'
import RoomSizePanel from './panels/RoomSizePanel'
import FloorPlanEditor from './panels/FloorPlanEditor'
import WallPhotoPanel from './panels/WallPhotoPanel'
import FurnitureCatalog, { addToRoom } from './panels/FurnitureCatalog'
import ChatPanel from './panels/ChatPanel'
import SelectedFurniturePanel, { useFurnitureShortcuts } from './panels/SelectedFurniturePanel'

const WIDE_QUERY = '(min-width: 1024px)'

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function useWideScreen() {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => false)
}

const segClass = (active: boolean) =>
  `flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 py-1.5 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 ease-soft disabled:cursor-not-allowed disabled:opacity-40 sm:gap-2 sm:px-4 ${
    active ? 'bg-white text-ink shadow-card' : 'text-ink-3 hover:text-ink'
  }`

const stepNoClass = (active: boolean) =>
  `flex h-5 w-5 items-center justify-center rounded-pill text-[11px] font-bold ${active ? 'bg-brand-500 text-white' : 'bg-surface-2 text-ink-3'}`

const menuItemClass = 'flex w-full items-center gap-2.5 rounded-field px-3 py-2 text-left text-sm text-ink-2 transition-colors duration-200 ease-soft hover:bg-surface hover:text-ink'

const tabClass = (active: boolean) =>
  `flex flex-1 items-center justify-center gap-1.5 rounded-pill py-1.5 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 ease-soft ${
    active ? 'bg-white text-ink shadow-card' : 'text-ink-3 hover:text-ink'
  }`

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
  const wide = useWideScreen()
  const hasSelection = useRoomStore((s) => s.selectedFurnitureId !== null)
  useFurnitureShortcuts()
  useCatalogLoader()
  useHistoryShortcuts(stage === 'furniture')

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

  const closeMenu = () => {
    setMenu(false)
    setConfirmReset(false)
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-canvas text-ink">
      <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-white/80 px-4 backdrop-blur-xl sm:px-5">
        <Wordmark compact />
        <nav className="mx-auto flex shrink-0 rounded-pill bg-surface p-1" aria-label="步驟">
          <button onClick={() => setStage('room')} className={segClass(stage === 'room')} aria-current={stage === 'room' ? 'step' : undefined}>
            <span className={stepNoClass(stage === 'room')}>1</span>
            建立房間
            <span className="tabular-nums text-[11px] font-normal text-ink-4">
              {confirmed}/{room.walls.length}
            </span>
          </button>
          <button
            disabled={!ready}
            onClick={() => setStage('furniture')}
            title={ready ? '' : '請先確認所有牆面'}
            className={segClass(stage === 'furniture')}
            aria-current={stage === 'furniture' ? 'step' : undefined}
          >
            <span className={stepNoClass(stage === 'furniture')}>2</span>
            擺放家具
            {!ready && <Lock size={12} strokeWidth={2} className="text-ink-4" aria-hidden="true" />}
          </button>
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <Link href="/plan" className={buttonClass('secondary', 'sm')}>
              <FileText {...ICON} />
              輸出設計圖
            </Link>
          </div>
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className={iconBtnClass} aria-label="選單" aria-expanded={menu}>
              <Menu {...ICON} />
            </button>
            {menu && (
              <div className="absolute right-0 top-11 z-30 flex w-64 flex-col gap-0.5 rounded-card border border-line bg-white p-1.5 shadow-float" onMouseLeave={closeMenu}>
                <Link href="/plan" className={`${menuItemClass} md:hidden`}>
                  <FileText {...ICON} className="text-ink-3" />
                  輸出設計圖（PDF／CAD）
                </Link>
                <button
                  className={menuItemClass}
                  onClick={async () => {
                    closeMenu()
                    await exportRoom()
                    flash('已匯出房間 JSON')
                  }}
                >
                  <Download {...ICON} className="text-ink-3" />
                  匯出房間 JSON
                </button>
                <button
                  className={menuItemClass}
                  onClick={() => {
                    closeMenu()
                    importRef.current?.click()
                  }}
                >
                  <Upload {...ICON} className="text-ink-3" />
                  匯入房間 JSON
                </button>
                <Link href="/licenses" className={menuItemClass}>
                  <ScrollText {...ICON} className="text-ink-3" />
                  素材來源與授權
                </Link>
                <div className="my-1 border-t border-line" />
                {confirmReset ? (
                  <div className="flex flex-col gap-2 rounded-field bg-danger/10 px-3 py-2.5 text-xs leading-relaxed text-danger">
                    <span>確定清除目前房間與家具？無法復原，建議先匯出 JSON 備份。</span>
                    <span className="flex gap-2">
                      <button className="flex-1 rounded-pill border border-line bg-white py-1 font-medium text-ink-2 hover:bg-surface" onClick={() => setConfirmReset(false)}>
                        取消
                      </button>
                      <button
                        className="flex-1 rounded-pill bg-danger py-1 font-medium text-white hover:bg-danger/90"
                        onClick={() => {
                          closeMenu()
                          resetAll()
                        }}
                      >
                        清除
                      </button>
                    </span>
                  </div>
                ) : (
                  <button className={`${menuItemClass} text-danger hover:bg-danger/10 hover:text-danger`} onClick={() => setConfirmReset(true)}>
                    <Trash {...ICON} />
                    重新開始
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
        </div>
      </header>

      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <RoomScene />
          <ViewControls />
          {stage === 'furniture' && <HistoryControls />}
          {stage === 'furniture' && wide && hasSelection && (
            <div className="absolute bottom-4 right-4 max-h-[calc(100%-5rem)] w-[min(620px,calc(100%-352px))] min-w-[300px] overflow-y-auto rounded-card">
              <SelectedFurniturePanel floating />
            </div>
          )}
          <div
            className={`pointer-events-none absolute left-4 top-4 rounded-pill bg-white/85 px-3.5 py-1.5 text-xs text-ink-2 shadow-card backdrop-blur-md ${
              stage === 'furniture' ? 'max-w-[calc(100%-13rem)]' : 'max-w-[70%]'
            }`}
          >
            {stage === 'room'
              ? selectedWall === null
                ? '左鍵旋轉・右鍵平移・滾輪縮放・WASD 移動・點一面牆開始拍照'
                : `正在編輯牆 ${selectedWall + 1}・可直接拖曳牆上的方塊`
              : '拖曳家具移動（會停在牆邊）・右鍵平移視角・WASD 移動・紅色代表重疊或擋門'}
          </div>
          <button onClick={() => setPanelOpen((o) => !o)} className={buttonClass('primary', 'sm', 'absolute bottom-4 right-4 md:hidden')}>
            {panelOpen ? '收起面板' : '打開面板'}
            {panelOpen ? <ChevronDown size={14} strokeWidth={2} /> : <ChevronUp size={14} strokeWidth={2} />}
          </button>
        </div>

        <aside
          className={`z-10 flex shrink-0 flex-col border-line bg-white md:h-auto md:w-[400px] md:border-l ${panelOpen ? 'h-[48dvh]' : 'h-0'} border-t md:border-t-0`}
        >
          {stage === 'furniture' && (
            <div className="shrink-0 px-5 pt-4">
              <div className="flex rounded-pill bg-surface p-1">
                <button onClick={() => setTab('catalog')} className={tabClass(tab === 'catalog')}>
                  <Sofa size={15} strokeWidth={1.75} />
                  家具庫
                </button>
                <button onClick={() => setTab('chat')} className={tabClass(tab === 'chat')}>
                  <MessageSquare size={15} strokeWidth={1.75} />
                  配置需求
                </button>
              </div>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
            {stage === 'room' ? (
              selectedWall === null ? <RoomSizePanel /> : <WallPhotoPanel />
            ) : (
              <div className="flex flex-col gap-4">
                {!wide && <SelectedFurniturePanel />}
                {tab === 'catalog' ? <FurnitureCatalog /> : <ChatPanel />}
              </div>
            )}
            <div className="h-5" />
          </div>
        </aside>
      </main>

      <FloorPlanEditor />
      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-pill bg-ink px-4 py-2 text-sm text-white shadow-float">{toast}</div>}
    </div>
  )
}
