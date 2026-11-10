'use client'

import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleQuestionMark, Hand, Keyboard, Mouse } from 'lucide-react'
import { sceneBridge, type ViewCommand } from './bridge'
import { floatBtnClass, floatIconBtnClass } from '@/components/ui/fields'

const ICON = { size: 16, strokeWidth: 1.75 } as const

const HELP = [
  { icon: Mouse, text: '左鍵拖曳：360° 旋轉' },
  { icon: Mouse, text: '右鍵拖曳（或 Shift＋左鍵）：前後左右平移' },
  { icon: Mouse, text: '滾輪：往游標方向拉近／拉遠' },
  { icon: Keyboard, text: 'W／S 或 ↑／↓：往前／往後走' },
  { icon: Keyboard, text: 'A／D：往左／往右；Q／E 或 ←／→：轉向' },
  { icon: Keyboard, text: 'X／Z：視角升高／降低' },
  { icon: Hand, text: '手機：單指旋轉、雙指平移與縮放' },
]

export default function ViewControls() {
  const [help, setHelp] = useState(false)
  const run = (c: ViewCommand) => sceneBridge.view?.(c)
  return (
    <div className="absolute bottom-4 left-[72px] flex flex-col items-start gap-2">
      {help && (
        <div className="max-w-[280px] rounded-card border border-line bg-white/95 p-4 text-xs leading-relaxed text-ink-2 shadow-float backdrop-blur-md">
          <p className="mb-2 text-sm font-bold text-ink">視角操作</p>
          <ul className="flex flex-col gap-1.5">
            {HELP.map((h, i) => (
              <li key={i} className="flex items-start gap-2">
                <h.icon size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-4" aria-hidden="true" />
                <span>{h.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="grid grid-cols-3 gap-1">
          <span />
          <button className={floatIconBtnClass} onClick={() => run('forward')} title="往前（W）" aria-label="往前">
            <ChevronUp {...ICON} />
          </button>
          <span />
          <button className={floatIconBtnClass} onClick={() => run('left')} title="往左（A）" aria-label="往左">
            <ChevronLeft {...ICON} />
          </button>
          <button className={floatIconBtnClass} onClick={() => run('back')} title="往後（S）" aria-label="往後">
            <ChevronDown {...ICON} />
          </button>
          <button className={floatIconBtnClass} onClick={() => run('right')} title="往右（D）" aria-label="往右">
            <ChevronRight {...ICON} />
          </button>
        </div>
        <div className="flex flex-col gap-1">
          <button className={floatBtnClass} onClick={() => run('top')}>
            俯視
          </button>
          <button className={floatBtnClass} onClick={() => run('reset')}>
            重設
          </button>
        </div>
        <button className={floatIconBtnClass} onClick={() => setHelp((h) => !h)} title="操作說明" aria-label="操作說明" aria-pressed={help}>
          <CircleQuestionMark {...ICON} />
        </button>
      </div>
    </div>
  )
}
