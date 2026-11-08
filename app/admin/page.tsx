import type { Metadata } from 'next'
import AdminShell from '@/components/admin/AdminShell'

export const metadata: Metadata = { title: '家具庫管理｜AI室內設計師', robots: { index: false, follow: false } }

export default function AdminPage() {
  return <AdminShell />
}
