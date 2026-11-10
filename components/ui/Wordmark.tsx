import Link from 'next/link'

export default function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-ink" aria-label="AI室內設計師 首頁">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-brand-500 text-white">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M6 10v9h12v-9" />
        </svg>
      </span>
      <span className={compact ? 'hidden sm:inline' : ''}>AI室內設計師</span>
    </Link>
  )
}
