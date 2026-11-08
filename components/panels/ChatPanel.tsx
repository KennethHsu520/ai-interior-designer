'use client'

import { useEffect, useRef, useState } from 'react'
import { useRoomStore } from '@/store/useRoomStore'
import { requestLayout } from '@/lib/requestLayout'
import { parseRequest, PREF_OPTIONS, prefActive, togglePref } from '@/lib/layoutEngine'
import { UndoLayoutButton } from '@/components/scene/HistoryControls'

const SUPPORTED = PREF_OPTIONS.map((o) => `「${o.label}」`).join('、')

export default function ChatPanel() {
  const count = useRoomStore((s) => s.furniture.length)
  const prefs = useRoomStore((s) => s.layoutPrefs)
  const setPrefs = useRoomStore((s) => s.setLayoutPrefs)
  const messages = useRoomStore((s) => s.chat)
  const addChatMessage = useRoomStore((s) => s.addChatMessage)
  const clearChat = useRoomStore((s) => s.clearChat)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const activeCount = PREF_OPTIONS.filter((o) => prefActive(prefs, o)).length

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages])

  const arrange = async (lead?: string) => {
    setBusy(true)
    try {
      const r = await requestLayout()
      addChatMessage({ role: 'ai', text: lead ? `${lead}${r.explanation}` : r.explanation, kind: r.failed ? 'warn' : undefined, revision: r.revision })
    } catch (e) {
      addChatMessage({ role: 'ai', text: e instanceof Error ? e.message : '配置失敗', kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const send = async (text: string) => {
    const t = text.trim()
    if (!t || busy) return
    setInput('')
    addChatMessage({ role: 'user', text: t })
    const parsed = parseRequest(t, useRoomStore.getState().layoutPrefs)
    if (!parsed.matched.length) {
      addChatMessage({ role: 'ai', text: `這句話我還看不懂。目前支援的需求有：${SUPPORTED}。也可以直接點上方的按鈕開關。`, kind: 'warn' })
      return
    }
    setPrefs(parsed.prefs)
    const lead = `${parsed.turnedOff ? '已關閉' : '已開啟'}：${parsed.matched.join('、')}。`
    if (!count) {
      addChatMessage({ role: 'ai', text: `${lead}房間裡還沒有家具，加入家具後按「依需求重新配置」就會套用。` })
      return
    }
    await arrange(lead)
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-bold text-slate-800">配置需求</h2>
          <span className="text-[11px] text-slate-400">{activeCount ? `已開啟 ${activeCount} 項，會記住` : '點選想要的需求'}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PREF_OPTIONS.map((o) => {
            const on = prefActive(prefs, o)
            return (
              <button
                key={o.label}
                title={o.hint}
                aria-pressed={on}
                onClick={() => setPrefs(togglePref(prefs, o))}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  on ? 'border-violet-500 bg-violet-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50'
                }`}
              >
                {on ? '✓ ' : ''}
                {o.label}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500">
          內建規則一定會做到：家具不穿牆、不重疊、不擋門；床、沙發、櫃子靠牆；保留 90 公分主要走道；床頭避開窗戶下方；不擋開關插座。
        </p>
        <button
          disabled={busy || count === 0}
          onClick={() => arrange()}
          className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? '配置中…' : `✨ 依需求重新配置（${count} 件家具）`}
        </button>
        {count === 0 && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">房間裡還沒有家具，先到「家具庫」加入幾件吧。</p>}
      </section>

      <section className="flex flex-col gap-2 border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">用一句話告訴我</span>
          <button
            onClick={clearChat}
            disabled={busy || messages.length === 0}
            className="rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-red-600 disabled:opacity-40"
          >
            清除紀錄
          </button>
        </div>
        {messages.length === 0 && <p className="text-[11px] text-slate-400">例如：「床靠窗」「書桌放窗邊」「家裡有人坐輪椅」「想要寬敞一點」。我會幫你打開對應的需求再重新配置。</p>}
        <div className="flex flex-col gap-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'self-end rounded-br-sm bg-sky-600 text-white'
                  : m.kind === 'error'
                    ? 'self-start rounded-bl-sm bg-red-50 text-red-700'
                    : m.kind === 'warn'
                      ? 'self-start rounded-bl-sm bg-amber-50 text-amber-800'
                      : 'self-start rounded-bl-sm bg-slate-100 text-slate-800'
              }`}
            >
              {m.text}
              {m.role === 'ai' && <UndoLayoutButton revision={m.revision} />}
            </div>
          ))}
          {busy && <div className="self-start rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-500">排列中…</div>}
          <div ref={endRef} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
          className="sticky bottom-0 flex gap-2 bg-white py-1"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="例如：床靠窗、留輪椅走道…"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300"
          />
          <button disabled={busy || !input.trim()} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-300">
            送出
          </button>
        </form>
      </section>
    </div>
  )
}
