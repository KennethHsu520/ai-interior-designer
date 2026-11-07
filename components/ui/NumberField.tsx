'use client'

import { useState } from 'react'

export default function NumberField({
  label,
  value,
  onCommit,
  step = 0.01,
  suffix = 'm',
  validate,
  compact,
  digits = 2,
  disabled,
}: {
  label?: string
  value: number
  onCommit: (v: number) => void
  step?: number
  suffix?: string
  validate?: (v: number) => string | null
  compact?: boolean
  digits?: number
  disabled?: boolean
}) {
  const [text, setText] = useState(value.toFixed(digits))
  const [synced, setSynced] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)

  if (!focused && synced !== value) {
    setSynced(value)
    setText(value.toFixed(digits))
  }

  const commit = () => {
    const f = 10 ** digits
    const v = Math.round(parseFloat(text) * f) / f
    if (!Number.isFinite(v)) {
      setError('請輸入數字')
      return
    }
    const err = validate?.(v) ?? null
    setError(err)
    if (err) return
    setText(v.toFixed(digits))
    setSynced(v)
    if (v !== Math.round(value * f) / f) onCommit(v)
  }

  return (
    <label className={`flex flex-col gap-1 ${compact ? 'text-[11px]' : 'text-xs'}`}>
      {label && <span className="font-medium text-slate-500">{label}</span>}
      <span
        className={`flex items-center rounded-lg border px-2 focus-within:ring-2 focus-within:ring-sky-300 ${
          error ? 'border-red-400' : 'border-slate-200'
        } ${disabled ? 'bg-slate-100' : 'bg-white'}`}
      >
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={text}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            setFocused(false)
            commit()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          className={`w-full min-w-0 bg-transparent disabled:text-slate-500 outline-none ${compact ? 'py-1 text-xs' : 'py-1.5 text-sm'} tabular-nums text-slate-800`}
        />
        <span className="pl-1 text-slate-400">{suffix}</span>
      </span>
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </label>
  )
}
