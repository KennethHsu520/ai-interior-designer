'use client'

import dynamic from 'next/dynamic'

const Editor = dynamic(() => import('./Editor'), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-3 bg-canvas text-sm text-ink-3">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand-500" aria-hidden="true" />
      載入 3D 房間中…
    </div>
  ),
})

export default function AppShell() {
  return <Editor />
}
