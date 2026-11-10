'use client'

import { useState, type ReactNode } from 'react'

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
  suffix?: ReactNode
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
    <label className="flex flex-col gap-1">
      {label && <span className="text-xs font-medium text-ink-3">{label}</span>}
      <span
        className={`flex items-center rounded-field border transition-[border-color,box-shadow] duration-200 ease-soft focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-200 ${
          compact ? 'h-8 px-2.5' : 'h-10 px-3'
        } ${error ? 'border-danger/60' : 'border-line'} ${disabled ? 'bg-surface' : 'bg-white'}`}
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
          className={`w-full min-w-0 bg-transparent tabular-nums text-ink outline-none disabled:text-ink-3 ${compact ? 'text-xs' : 'text-sm'}`}
        />
        <span className={`flex shrink-0 items-center pl-1 text-ink-4 ${compact ? 'text-[11px]' : 'text-xs'}`}>{suffix}</span>
      </span>
      {error && <span className="text-[11px] text-danger">{error}</span>}
    </label>
  )
}
