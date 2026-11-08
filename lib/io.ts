'use client'

import { z } from 'zod'
import { useRoomStore } from '@/store/useRoomStore'
import { migrateCeilingItem } from '@/types/room'
import type { CeilingItem, DoorSwing, PhotoBounds, PlacedFurniture, Room, Vec2, Wall, WallItem } from '@/types/room'
import { loadPhoto, PHOTO_PREFIX, savePhoto } from './image'
import { validateFloor } from './geometry'

type SameShape<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? [keyof A] extends [keyof B]
      ? [keyof B] extends [keyof A]
        ? true
        : false
      : false
    : false
  : false

const Vec2Schema = z.object({ x: z.number(), z: z.number() })

const SwingSchema = z.object({
  hinge: z.enum(['start', 'end']),
  side: z.enum(['in', 'out']),
  angle: z.number(),
})

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
  swing: SwingSchema.optional(),
})

const BoundsSchema = z.object({ x0: z.number(), x1: z.number(), y0: z.number(), y1: z.number() })

const WallSchema = z.object({
  id: z.string(),
  index: z.number(),
  photoUrl: z.string().optional(),
  photoBounds: BoundsSchema.optional(),
  confirmed: z.boolean().optional(),
  lengthLocked: z.boolean().optional(),
  angleLocked: z.boolean().optional(),
  items: z.array(ItemSchema),
})

const CeilingSchema = z.object({
  id: z.string(),
  type: ItemSchema.shape.type,
  label: z.string(),
  x: z.number(),
  z: z.number(),
  width: z.number(),
  depth: z.number(),
  confidence: z.number().optional(),
  confirmed: z.boolean(),
  sourceWallId: z.string().optional(),
})

const RoomSchema = z.object({
  id: z.string(),
  name: z.string(),
  floor: z.array(Vec2Schema).min(3),
  height: z.number(),
  walls: z.array(WallSchema),
  ceilingItems: z.array(CeilingSchema).default([]),
})

const FurnitureSchema = z.object({
  id: z.string(),
  catalogId: z.string(),
  position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  rotationY: z.number(),
  scale: z.number(),
  size: z.object({ width: z.number(), depth: z.number(), height: z.number() }).optional(),
  colors: z.record(z.string(), z.string()).optional(),
})

const schemaMatchesTypes: [
  SameShape<z.output<typeof Vec2Schema>, Vec2>,
  SameShape<z.output<typeof SwingSchema>, DoorSwing>,
  SameShape<z.output<typeof ItemSchema>, WallItem>,
  SameShape<z.output<typeof CeilingSchema>, CeilingItem>,
  SameShape<z.output<typeof BoundsSchema>, PhotoBounds>,
  SameShape<z.output<typeof WallSchema>, Wall>,
  SameShape<z.output<typeof RoomSchema>, Room>,
  SameShape<z.output<typeof FurnitureSchema>, PlacedFurniture>,
] = [true, true, true, true, true, true, true, true]
void schemaMatchesTypes

const FileSchema = z.object({
  app: z.literal('ai-interior-designer'),
  version: z.number(),
  room: RoomSchema,
  furniture: z.array(FurnitureSchema).default([]),
  photos: z.record(z.string(), z.string()).default({}),
})

const LegacyFileSchema = FileSchema.extend({
  room: RoomSchema.extend({ ceilingItems: z.array(ItemSchema).default([]) }),
})

const FILE_VERSION = 2

function parseFile(raw: unknown) {
  const version = (raw as { version?: unknown } | null)?.version
  if (typeof version === 'number' && version > FILE_VERSION) throw new Error('這個檔案來自較新版本的網站，請重新整理頁面後再試')
  if (typeof version === 'number' && version < 2) {
    const legacy = LegacyFileSchema.safeParse(raw)
    if (!legacy.success) return null
    return { ...legacy.data, room: { ...legacy.data.room, ceilingItems: legacy.data.room.ceilingItems.map(migrateCeilingItem) } }
  }
  const parsed = FileSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

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
  const json = JSON.stringify({ app: 'ai-interior-designer', version: FILE_VERSION, exportedAt: new Date().toISOString(), room, furniture, photos }, null, 2)
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
  const data = parseFile(raw)
  if (!data) throw new Error('檔案格式不正確，請選擇本網站匯出的房間檔')
  if (validateFloor(data.room.floor).length) throw new Error('檔案中的房間格局不正確')
  for (const [ref, dataUrl] of Object.entries(data.photos)) {
    if (ref.startsWith(PHOTO_PREFIX) && dataUrl.startsWith('data:image/')) await savePhoto(ref.slice(PHOTO_PREFIX.length), dataUrl)
  }
  useRoomStore.getState().importData({ room: data.room, furniture: data.furniture })
}
