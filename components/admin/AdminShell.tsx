'use client'

import dynamic from 'next/dynamic'

const AdminApp = dynamic(() => import('./AdminApp'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-dvh items-center justify-center gap-3 bg-canvas text-sm text-ink-3">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand-500" aria-hidden="true" />
      載入管理頁面中…
    </div>
  ),
})

export default function AdminShell() {
  return <AdminApp />
}
