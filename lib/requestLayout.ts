'use client'

import { useRoomStore } from '@/store/useRoomStore'
import { CATALOG_MAP } from './catalog'
import { heuristicLayout } from './layout'

export type LayoutResult = { explanation: string; failed: number; revision: number }

export async function requestLayout(mode: 'auto' | 'adjust'): Promise<LayoutResult> {
  const { room, furniture } = useRoomStore.getState()
  if (!furniture.length) throw new Error('房間裡還沒有家具')
  const known = furniture.filter((f) => CATALOG_MAP.has(f.catalogId))
  const { list, failed } = heuristicLayout(room, known, CATALOG_MAP)
  const placed = new Map(list.map((f) => [f.id, f]))
  const next = furniture.map((f) => placed.get(f.id) ?? f)
  const moved = next.filter((f, i) => f.position.x !== furniture[i].position.x || f.position.z !== furniture[i].position.z || f.rotationY !== furniture[i].rotationY).length
  useRoomStore.getState().setFurnitureList(next)
  const explanation =
    mode === 'adjust' ? '目前還看不懂文字需求，先用內建規則重新排列了家具。' : `已用內建規則重新排列 ${moved} 件家具，大型家具優先靠牆。`
  return { explanation, failed: failed.length, revision: useRoomStore.getState().revision }
}
