'use client'

import { useMemo } from 'react'
import { useRoomStore } from '@/store/useRoomStore'
import { CATALOG_MAP } from './catalog'
import { checkFurniture } from './collision'

export function useCollisions() {
  const room = useRoomStore((s) => s.room)
  const furniture = useRoomStore((s) => s.furniture)
  return useMemo(() => checkFurniture(room, furniture, CATALOG_MAP), [room, furniture])
}
