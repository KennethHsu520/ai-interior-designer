'use client'

import { useEffect } from 'react'
import { useRoomStore } from '@/store/useRoomStore'

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
}

export function useHistoryShortcuts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || isTyping(e.target)) return
      const key = e.key.toLowerCase()
      const st = useRoomStore.getState()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        st.undoFurniture()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        st.redoFurniture()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}

const btn =
  'flex h-9 items-center gap-1 rounded-lg bg-white/90 px-3 text-xs font-semibold text-slate-700 shadow backdrop-blur hover:bg-white active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40'

export default function HistoryControls() {
  const canUndo = useRoomStore((s) => s.past.length > 0)
  const canRedo = useRoomStore((s) => s.future.length > 0)
  const undo = useRoomStore((s) => s.undoFurniture)
  const redo = useRoomStore((s) => s.redoFurniture)
  return (
    <div className="absolute right-3 top-3 flex gap-1.5">
      <button className={btn} disabled={!canUndo} onClick={undo} title="復原（Ctrl+Z）" aria-label="復原">
        ↶ 復原
      </button>
      <button className={btn} disabled={!canRedo} onClick={redo} title="重做（Ctrl+Shift+Z）" aria-label="重做">
        ↷ 重做
      </button>
    </div>
  )
}

export function UndoLayoutButton({ revision }: { revision?: number }) {
  const current = useRoomStore((s) => s.revision)
  const undo = useRoomStore((s) => s.undoFurniture)
  if (revision === undefined) return null
  if (current !== revision) return null
  return (
    <button onClick={undo} className="mt-1 block rounded-md border border-current/30 bg-white/70 px-2 py-0.5 text-[11px] font-semibold hover:bg-white">
      ↶ 復原這次調整
    </button>
  )
}
