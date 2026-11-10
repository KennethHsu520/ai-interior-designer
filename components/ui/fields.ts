export const ICON = { size: 16, strokeWidth: 1.75 } as const

const fieldBase =
  'w-full min-w-0 rounded-field border border-line bg-white text-ink outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-soft placeholder:text-ink-4 focus:border-brand-400 focus:ring-2 focus:ring-brand-200 disabled:bg-surface disabled:text-ink-3'

export const inputClass = `${fieldBase} h-10 px-3 text-sm`
export const inputSmClass = `${fieldBase} h-8 px-2.5 text-xs`
export const selectClass = `${fieldBase} h-10 px-3 text-sm`
export const selectSmClass = `${fieldBase} h-8 px-2 text-xs`

export const labelClass = 'text-xs font-medium text-ink-3'
export const sectionTitleClass = 'text-[15px] font-bold tracking-tight text-ink'
export const subTitleClass = 'text-sm font-bold text-ink'
export const helpTextClass = 'text-xs leading-relaxed text-ink-3'

export function chipClass(active: boolean, extra = '') {
  return `inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-medium transition-colors duration-200 ease-soft ${
    active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2 hover:border-line-2 hover:bg-surface'
  } ${extra}`
}

export function brandChipClass(active: boolean, extra = '') {
  return `inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-medium transition-colors duration-200 ease-soft ${
    active ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-white text-ink-2 hover:border-brand-300 hover:bg-brand-50'
  } ${extra}`
}

export const iconBtnClass =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border border-line bg-white text-ink-2 shadow-hairline transition-colors duration-200 ease-soft hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-40'

export const floatBtnClass =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-pill bg-white/90 px-3 text-xs font-medium text-ink-2 shadow-card backdrop-blur-md transition-colors duration-200 ease-soft hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-40'

export const floatIconBtnClass =
  'inline-flex h-9 w-9 items-center justify-center rounded-pill bg-white/90 text-ink-2 shadow-card backdrop-blur-md transition-colors duration-200 ease-soft hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-40'

export const smallBtnClass =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-pill border border-line bg-white px-3 text-xs font-medium text-ink-2 transition-colors duration-200 ease-soft hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-40'

export const smallDarkBtnClass =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-pill bg-ink px-3 text-xs font-medium text-white transition-colors duration-200 ease-soft hover:bg-ink-2 disabled:pointer-events-none disabled:opacity-40'

export const smallDangerBtnClass =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-pill border border-danger/40 bg-white px-3 text-xs font-medium text-danger transition-colors duration-200 ease-soft hover:bg-danger/10 disabled:pointer-events-none disabled:opacity-40'

export const noteClass: Record<'ok' | 'warn' | 'error', string> = {
  ok: 'rounded-field bg-sage-100 px-3 py-2 text-xs leading-relaxed text-sage-700',
  warn: 'rounded-field bg-brand-50 px-3 py-2 text-xs leading-relaxed text-brand-700',
  error: 'rounded-field bg-danger/10 px-3 py-2 text-xs leading-relaxed text-danger',
}

export const cardClass = 'rounded-card border border-line bg-white shadow-hairline'
export const stickyBarClass = 'sticky bottom-0 -mx-5 flex flex-col gap-2 border-t border-line bg-white/95 px-5 py-3 backdrop-blur-md'
