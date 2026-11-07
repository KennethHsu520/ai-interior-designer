import type { Metadata } from 'next'
import PlanSheets from '@/components/plan/PlanSheets'

export const metadata: Metadata = { title: '設計圖輸出｜AI室內設計師' }

export default function PlanPage() {
  return <PlanSheets />
}
