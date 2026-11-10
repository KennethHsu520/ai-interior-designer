'use client'

import dynamic from 'next/dynamic'
import { MousePointer2 } from 'lucide-react'

const HeroScene = dynamic(() => import('./HeroScene'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-brand-50 to-surface" />,
})

export default function HeroVisual() {
  return (
    <div className="relative aspect-[5/4] w-full overflow-hidden rounded-hero bg-gradient-to-br from-brand-50 via-canvas to-sage-100 shadow-hero sm:aspect-[4/3] lg:aspect-[5/4]">
      <div className="pointer-events-none absolute inset-0 rounded-hero shadow-[inset_0_0_0_1px_rgba(29,29,31,0.06)]" />
      <HeroScene />
      <div className="pointer-events-none absolute left-5 top-5 flex items-center gap-2 rounded-pill bg-white/85 px-3 py-1.5 text-xs font-medium text-ink-2 shadow-hairline backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        客廳 4.2 × 3.4 m
      </div>
      <div className="pointer-events-none absolute bottom-5 right-5 flex items-center gap-1.5 rounded-pill bg-white/85 px-3 py-1.5 text-xs text-ink-3 shadow-hairline backdrop-blur">
        <MousePointer2 size={13} strokeWidth={1.75} />
        拖曳可旋轉視角
      </div>
    </div>
  )
}
