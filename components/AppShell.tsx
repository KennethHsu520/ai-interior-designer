'use client'

import dynamic from 'next/dynamic'

const Editor = dynamic(() => import('./Editor'), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh w-full items-center justify-center bg-slate-100 text-sm text-slate-500">載入 3D 房間中…</div>
  ),
})

export default function AppShell() {
  return <Editor />
}
