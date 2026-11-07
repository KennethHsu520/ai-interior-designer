'use client'

import { z } from 'zod'
import { useRoomStore } from '@/store/useRoomStore'
import type { PlacedFurniture, Room } from '@/types/room'
import { loadPhoto, PHOTO_PREFIX, savePhoto } from './image'
import { validateFloor } from './geometry'

const ItemSchema = z.object({
  id: z.string(),
  type: z.enum(['door', 'window', 'switch', 'outlet', 'light', 'air_conditioner', 'furniture', 'other']),
  label: z.string(),
  offset: z.number(),
  elevation: z.number(),
  width: z.number(),
  height: z.number(),
  confidence: z.number().optional(),
  confirmed: z.boolean(),
})

const FileSchema = z.object({
  app: z.literal('ai-interior-designer'),
  version: z.number(),
  room: z.object({
    id: z.string(),
    name: z.string(),
    floor: z.array(z.object({ x: z.number(), z: z.number() })).min(3),
    height: z.number(),
    walls: z.array(
      z.object({
        id: z.string(),
        index: z.number(),
        photoUrl: z.string().optional(),
        photoBounds: z.object({ x0: z.number(), x1: z.number(), y0: z.number(), y1: z.number() }).optional(),
        confirmed: z.boolean().optional(),
        items: z.array(ItemSchema),
      }),
    ),
    ceilingItems: z.array(ItemSchema).default([]),
  }),
  furniture: z
    .array(
      z.object({
        id: z.string(),
        catalogId: z.string(),
        position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
        rotationY: z.number(),
        scale: z.number(),
        size: z.object({ width: z.number(), depth: z.number(), height: z.number() }).optional(),
        colors: z.record(z.string(), z.string()).optional(),
      }),
    )
    .default([]),
  photos: z.record(z.string(), z.string()).default({}),
})

export async function exportRoom(includePhotos = true) {
  const { room, furniture } = useRoomStore.getState()
  const photos: Record<string, string> = {}
  if (includePhotos) {
    for (const w of room.walls) {
      if (w.photoUrl?.startsWith(PHOTO_PREFIX)) {
        const data = await loadPhoto(w.photoUrl)
        if (data) photos[w.photoUrl] = data
      }
    }
  }
  const json = JSON.stringify({ app: 'ai-interior-designer', version: 1, exportedAt: new Date().toISOString(), room, furniture, photos }, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${room.name || 'room'}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function importRoom(file: File) {
  const text = await file.text()
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('不是有效的 JSON 檔')
  }
  const parsed = FileSchema.safeParse(raw)
  if (!parsed.success) throw new Error('檔案格式不正確，請選擇本網站匯出的房間檔')
  const data = parsed.data
  if (validateFloor(data.room.floor).length) throw new Error('檔案中的房間格局不正確')
  for (const [ref, dataUrl] of Object.entries(data.photos)) {
    if (ref.startsWith(PHOTO_PREFIX) && dataUrl.startsWith('data:image/')) await savePhoto(ref.slice(PHOTO_PREFIX.length), dataUrl)
  }
  useRoomStore.getState().importData({ room: data.room as Room, furniture: data.furniture as PlacedFurniture[] })
}
