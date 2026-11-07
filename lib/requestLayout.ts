'use client'

import { useRoomStore } from '@/store/useRoomStore'
import { CATALOG_MAP } from './catalog'
import { resolveAll } from './collision'

export type LayoutResult = { explanation: string; mock: boolean; failed: number; moved: number }

export async function requestLayout(mode: 'auto' | 'adjust', message?: string): Promise<LayoutResult> {
  const { room, furniture } = useRoomStore.getState()
  if (!furniture.length) throw new Error('房間裡還沒有家具')
  const res = await fetch('/api/auto-layout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: { ...room, walls: room.walls.map((w) => ({ id: w.id, index: w.index, items: w.items })) },
      furniture,
      message,
      mode,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'AI 配置失敗')
  const placements = data.placements as { id: string; x: number; z: number; rotationY: number }[]
  const current = useRoomStore.getState()
  const proposed = current.furniture.map((f) => {
    const p = placements.find((q) => q.id === f.id)
    return p ? { ...f, position: { x: p.x, y: 0, z: p.z }, rotationY: p.rotationY } : f
  })
  const { list, failed } = resolveAll(current.room, proposed, CATALOG_MAP)
  const moved = list.filter((f, i) => f.position.x !== proposed[i].position.x || f.position.z !== proposed[i].position.z || f.rotationY !== proposed[i].rotationY).length
  current.setFurnitureList(list)
  return { explanation: data.explanation as string, mock: !!data.mock, failed: failed.length, moved }
}
