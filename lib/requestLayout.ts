'use client'

import { useRoomStore } from '@/store/useRoomStore'
import { CATALOG_MAP } from './catalog'
import { autoLayout } from './layoutEngine'

export type LayoutResult = { explanation: string; failed: number; revision: number }

export async function requestLayout(): Promise<LayoutResult> {
  const { room, furniture, layoutPrefs } = useRoomStore.getState()
  if (!furniture.length) throw new Error('房間裡還沒有家具')
  await new Promise((r) => setTimeout(r, 0))
  const out = autoLayout(room, furniture, CATALOG_MAP, layoutPrefs)
  const moved = out.list.filter((f, i) => {
    const o = furniture[i]
    return Math.abs(f.position.x - o.position.x) > 0.005 || Math.abs(f.position.z - o.position.z) > 0.005 || Math.abs(f.rotationY - o.rotationY) > 0.001
  }).length
  useRoomStore.getState().setFurnitureList(out.list)
  const parts = [moved ? `重新配置了 ${moved} 件家具` : '目前的配置已經是最佳結果，沒有移動家具']
  if (out.met.length) parts.push(`已做到：${out.met.join('、')}`)
  if (out.unmet.length) parts.push(`沒辦法同時做到：${out.unmet.join('、')}`)
  if (out.failed.length) parts.push(`有 ${out.failed.length} 件找不到空位，已標成紅色`)
  return { explanation: `${parts.join('。')}。`, failed: out.failed.length, revision: useRoomStore.getState().revision }
}
