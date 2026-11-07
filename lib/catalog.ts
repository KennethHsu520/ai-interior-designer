import raw from '@/data/catalog.json'
import type { CatalogItem, PlacedFurniture } from '@/types/room'
import { PROCEDURAL_CATALOG } from './procedural'

export const CATALOG = [...(raw as CatalogItem[]), ...PROCEDURAL_CATALOG]

export function furnitureDims(f: Pick<PlacedFurniture, 'size' | 'scale'>, item: CatalogItem) {
  const s = f.size ?? item.size
  return { width: s.width * f.scale, depth: s.depth * f.scale, height: s.height * f.scale }
}

export function furnitureColors(f: Pick<PlacedFurniture, 'colors'>, item: CatalogItem) {
  return { ...(item.procedural?.colors ?? {}), ...(f.colors ?? {}) }
}

export const CATALOG_MAP = new Map(CATALOG.map((c) => [c.id, c]))

export const CATEGORIES = Array.from(new Set(CATALOG.map((c) => c.category)))

export const STYLES = Array.from(new Set(CATALOG.flatMap((c) => c.styles)))

export const CATEGORY_ICON: Record<string, string> = {
  床: '🛏️',
  沙發: '🛋️',
  桌: '🪵',
  椅: '🪑',
  櫃: '🗄️',
  燈: '💡',
  裝飾: '🖼️',
  植物: '🪴',
  地毯: '🟫',
  家電: '📺',
  衛浴: '🛁',
}
