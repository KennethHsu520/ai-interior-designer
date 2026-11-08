'use client'

import dynamic from 'next/dynamic'

const AdminApp = dynamic(() => import('./AdminApp'), {
  ssr: false,
  loading: () => <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-sm text-slate-500">載入管理頁面中…</div>,
})

export default function AdminShell() {
  return <AdminApp />
}
