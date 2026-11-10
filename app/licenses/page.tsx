import Link from 'next/link'
import type { Metadata } from 'next'
import LicensesContent from '@/components/LicensesContent'

export const metadata: Metadata = { title: '素材來源與授權｜AI室內設計師' }

export default function LicensesPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-slate-800">
      <Link href="/design" className="text-sm text-sky-600 hover:underline">
        ← 回到設計畫面
      </Link>
      <h1 className="mt-4 text-2xl font-black">素材來源與授權</h1>
      <LicensesContent />
      <p className="mt-8 text-xs text-slate-400">
        CC0 1.0 全文：
        <a href="https://creativecommons.org/publicdomain/zero/1.0/" className="text-sky-600 hover:underline" target="_blank" rel="noreferrer">
          creativecommons.org/publicdomain/zero/1.0
        </a>
      </p>
    </main>
  )
}
