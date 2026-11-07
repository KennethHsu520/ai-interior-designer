'use client'

import { useEffect, useRef, useState } from 'react'
import { useRoomStore } from '@/store/useRoomStore'
import { requestLayout } from '@/lib/requestLayout'

type Msg = { role: 'user' | 'ai'; text: string; kind?: 'warn' | 'error' }

const SUGGESTIONS = ['床靠窗', '我要北歐風的感覺', '留走道給輪椅', '沙發面向電視櫃', '讓房間看起來更寬敞']

export default function ChatPanel() {
  const count = useRoomStore((s) => s.furniture.length)
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'ai', text: '嗨！告訴我你想怎麼調整，例如「床靠窗」「留走道給輪椅」，我會重新安排房間裡的家具。' },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text: string) => {
    const t = text.trim()
    if (!t || busy) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: t }])
    setBusy(true)
    try {
      const r = await requestLayout('adjust', t)
      const extra = r.failed ? `（有 ${r.failed} 件放不下，已標紅）` : r.moved ? `（已自動微調 ${r.moved} 件避免碰撞）` : ''
      setMessages((m) => [...m, { role: 'ai', text: `${r.explanation}${extra}`, kind: r.mock ? 'warn' : undefined }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'ai', text: e instanceof Error ? e.message : '調整失敗', kind: 'error' }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-col gap-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
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
          </div>
        ))}
        {busy && <div className="self-start rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-500">AI 思考中…</div>}
        <div ref={endRef} />
      </div>
      {count === 0 && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">房間裡還沒有家具，先到「家具庫」加入幾件吧。</p>}
      <div className="flex flex-wrap gap-1">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            disabled={busy || count === 0}
            onClick={() => send(s)}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            {s}
          </button>
        ))}
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
          placeholder="跟 AI 說你的想法…"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300"
        />
        <button disabled={busy || !input.trim() || count === 0} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-300">
          送出
        </button>
      </form>
    </div>
  )
}
