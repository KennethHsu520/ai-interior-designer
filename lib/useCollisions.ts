'use client'

import { useMemo } from 'react'
import { useRoomStore } from '@/store/useRoomStore'
import { CATALOG_MAP, useCatalog } from './catalog'
import { checkFurniture } from './collision'

export function useCollisions() {
  const room = useRoomStore((s) => s.room)
  const furniture = useRoomStore((s) => s.furniture)
  const version = useCatalog((s) => s.version)
  return useMemo(() => {
    void version
    return checkFurniture(room, furniture, CATALOG_MAP)
  }, [room, furniture, version])
}
