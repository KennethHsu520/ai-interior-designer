import raw from '@/data/catalog.json'
import type { CatalogItem } from '@/types/room'

export const CATALOG = raw as CatalogItem[]

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
