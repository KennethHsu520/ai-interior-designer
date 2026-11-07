'use client'

import { useState } from 'react'
import { sceneBridge, type ViewCommand } from './bridge'

const btn = 'flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-sm text-slate-700 shadow hover:bg-white active:bg-slate-100'

export default function ViewControls() {
  const [help, setHelp] = useState(false)
  const run = (c: ViewCommand) => sceneBridge.view?.(c)
  return (
    <div className="absolute bottom-3 left-16 flex flex-col items-start gap-2">
      {help && (
        <div className="max-w-[260px] rounded-lg bg-white/95 p-3 text-[11px] leading-relaxed text-slate-600 shadow">
          <p className="mb-1 font-bold text-slate-800">視角操作</p>
          <p>🖱️ 左鍵拖曳：360° 旋轉</p>
          <p>🖱️ 右鍵拖曳（或 Shift＋左鍵）：前後左右平移</p>
          <p>🖱️ 滾輪：往游標方向拉近／拉遠</p>
          <p>⌨️ W／S 或 ↑／↓：往前／往後走</p>
          <p>⌨️ A／D：往左／往右；Q／E 或 ←／→：轉向</p>
          <p>⌨️ X／Z：視角升高／降低</p>
          <p>👆 手機：單指旋轉、雙指平移與縮放</p>
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="grid grid-cols-3 gap-1">
          <span />
          <button className={btn} onClick={() => run('forward')} title="往前（W）" aria-label="往前">
            ▲
          </button>
          <span />
          <button className={btn} onClick={() => run('left')} title="往左（A）" aria-label="往左">
            ◀
          </button>
          <button className={btn} onClick={() => run('back')} title="往後（S）" aria-label="往後">
            ▼
          </button>
          <button className={btn} onClick={() => run('right')} title="往右（D）" aria-label="往右">
            ▶
          </button>
        </div>
        <div className="flex flex-col gap-1">
          <button className={`${btn} w-auto px-2 text-xs`} onClick={() => run('top')}>
            俯視
          </button>
          <button className={`${btn} w-auto px-2 text-xs`} onClick={() => run('reset')}>
            重設
          </button>
        </div>
        <button className={btn} onClick={() => setHelp((h) => !h)} title="操作說明" aria-label="操作說明">
          ?
        </button>
      </div>
    </div>
  )
}
