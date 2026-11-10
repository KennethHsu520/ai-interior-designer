import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react'
import LicensesContent from '@/components/LicensesContent'
import Wordmark from '@/components/ui/Wordmark'
import { buttonClass, LinkButton } from '@/components/ui/Button'

export const metadata: Metadata = { title: '素材來源與授權｜AI室內設計師' }

export default function LicensesPage() {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-6">
          <div className="flex items-center gap-2">
            <Wordmark compact />
            <Link href="/design" className={buttonClass('ghost', 'sm')}>
              <ArrowLeft size={16} strokeWidth={1.75} />
              回到設計
            </Link>
          </div>
          <LinkButton href="/design" size="sm">
            開始設計
            <ArrowRight size={16} strokeWidth={2} />
          </LinkButton>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-14 lg:pt-20">
        <div className="max-w-2xl">
          <span className="text-[13px] font-medium uppercase tracking-wider text-brand-600">素材授權</span>
          <h1 className="mt-3 text-h2 font-bold text-ink lg:text-h1">素材來源與授權</h1>
          <p className="mt-5 text-body text-ink-2">本網站只使用授權清楚、可商用的 3D 素材與開源模型。這一頁列出每個來源、作者與授權條款，向所有創作者致謝。</p>
        </div>
        <LicensesContent />
        <p className="mt-16 flex flex-wrap items-center gap-1 border-t border-line pt-6 text-sm text-ink-3">
          CC0 1.0 全文：
          <a href="https://creativecommons.org/publicdomain/zero/1.0/" className="inline-flex items-center gap-1 text-brand-600 transition-colors hover:text-brand-700" target="_blank" rel="noreferrer">
            creativecommons.org/publicdomain/zero/1.0
            <ExternalLink size={13} strokeWidth={1.75} />
          </a>
        </p>
      </main>
    </div>
  )
}
