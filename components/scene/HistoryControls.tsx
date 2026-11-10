'use client'

import { useEffect } from 'react'
import { Redo2, Undo2 } from 'lucide-react'
import { useRoomStore } from '@/store/useRoomStore'
import { floatBtnClass } from '@/components/ui/fields'

const ICON = { size: 15, strokeWidth: 1.75 } as const

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

export default function HistoryControls() {
  const canUndo = useRoomStore((s) => s.past.length > 0)
  const canRedo = useRoomStore((s) => s.future.length > 0)
  const undo = useRoomStore((s) => s.undoFurniture)
  const redo = useRoomStore((s) => s.redoFurniture)
  return (
    <div className="absolute right-4 top-4 flex gap-1.5">
      <button className={floatBtnClass} disabled={!canUndo} onClick={undo} title="復原（Ctrl+Z）" aria-label="復原">
        <Undo2 {...ICON} />
        復原
      </button>
      <button className={floatBtnClass} disabled={!canRedo} onClick={redo} title="重做（Ctrl+Shift+Z）" aria-label="重做">
        <Redo2 {...ICON} />
        重做
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
    <button onClick={undo} className="mt-1.5 inline-flex items-center gap-1 rounded-pill border border-current/30 bg-white/70 px-2.5 py-0.5 text-[11px] font-medium transition-colors hover:bg-white">
      <Undo2 size={12} strokeWidth={1.75} />
      復原這次調整
    </button>
  )
}
