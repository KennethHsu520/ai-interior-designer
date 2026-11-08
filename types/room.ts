export type Vec2 = { x: number; z: number }

export type WallItemType =
  | 'door'
  | 'window'
  | 'switch'
  | 'outlet'
  | 'light'
  | 'air_conditioner'
  | 'furniture'
  | 'other'

export type DoorSwing = { hinge: 'start' | 'end'; side: 'in' | 'out'; angle: number }

export const DEFAULT_SWING: DoorSwing = { hinge: 'start', side: 'in', angle: 90 }

export type WallItem = {
  id: string
  type: WallItemType
  label: string
  offset: number
  elevation: number
  width: number
  height: number
  confidence?: number
  confirmed: boolean
  swing?: DoorSwing
}

export type PhotoBounds = { x0: number; x1: number; y0: number; y1: number }

export type Wall = {
  id: string
  index: number
  photoUrl?: string
  photoBounds?: PhotoBounds
  confirmed?: boolean
  lengthLocked?: boolean
  angleLocked?: boolean
  items: WallItem[]
}

export type CeilingItem = {
  id: string
  type: WallItemType
  label: string
  x: number
  z: number
  width: number
  depth: number
  confidence?: number
  confirmed: boolean
  sourceWallId?: string
}

export type LegacyCeilingItem = {
  id: string
  type: WallItemType
  label: string
  offset: number
  elevation: number
  width: number
  height: number
  confidence?: number
  confirmed: boolean
}

export function migrateCeilingItem(c: LegacyCeilingItem): CeilingItem {
  return {
    id: c.id,
    type: c.type,
    label: c.label,
    x: c.offset,
    z: c.elevation,
    width: c.width,
    depth: c.height,
    ...(c.confidence !== undefined ? { confidence: c.confidence } : {}),
    confirmed: c.confirmed,
  }
}

export type Room = {
  id: string
  name: string
  floor: Vec2[]
  height: number
  walls: Wall[]
  ceilingItems: CeilingItem[]
}

export type PlacedFurniture = {
  id: string
  catalogId: string
  position: { x: number; y: number; z: number }
  rotationY: number
  scale: number
  size?: { width: number; depth: number; height: number }
  colors?: Record<string, string>
}

export type CatalogItem = {
  id: string
  name: string
  category: string
  styles: string[]
  source: string
  license: string
  file: string
  size: { width: number; depth: number; height: number }
  rawSize: { width: number; depth: number; height: number }
  rawMin: { x: number; y: number; z: number }
  scale: number
  thumbnail?: string
  procedural?: { kind: string; colors: Record<string, string> }
  author?: string
  sourceUrl?: string
  published?: boolean
  custom?: boolean
}

export type Placement = {
  id?: string
  catalogId: string
  x: number
  z: number
  rotationY: number
}

export const WALL_ITEM_TYPES: { value: WallItemType; label: string; color: string }[] = [
  { value: 'door', label: '門', color: '#b7791f' },
  { value: 'window', label: '窗', color: '#3182ce' },
  { value: 'switch', label: '開關', color: '#805ad5' },
  { value: 'outlet', label: '插座', color: '#d53f8c' },
  { value: 'light', label: '電燈', color: '#ecc94b' },
  { value: 'air_conditioner', label: '冷氣', color: '#38b2ac' },
  { value: 'furniture', label: '現有家具', color: '#718096' },
  { value: 'other', label: '其他', color: '#a0aec0' },
]

export function itemTypeInfo(type: WallItemType) {
  return WALL_ITEM_TYPES.find((t) => t.value === type) ?? WALL_ITEM_TYPES[WALL_ITEM_TYPES.length - 1]
}
