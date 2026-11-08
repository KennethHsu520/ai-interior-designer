import raw from '@/data/catalog.json'
import { create } from 'zustand'
import type { CatalogItem, PlacedFurniture } from '@/types/room'
import { PROCEDURAL_CATALOG } from './procedural'

export const BUILTIN_MODELS = raw as CatalogItem[]

export type CatalogStatus = 'builtin' | 'cached' | 'online' | 'offline' | 'unconfigured'

type CatalogState = {
  items: CatalogItem[]
  status: CatalogStatus
  version: number
}

export const CATALOG_MAP = new Map<string, CatalogItem>()

let remoteModels: CatalogItem[] | null = null
let customItems: CatalogItem[] = []
let status: CatalogStatus = 'builtin'

function visibleItems() {
  const models = (remoteModels ?? BUILTIN_MODELS).filter((c) => c.published !== false)
  return [...customItems, ...models, ...PROCEDURAL_CATALOG]
}

function rebuildMap() {
  CATALOG_MAP.clear()
  for (const c of BUILTIN_MODELS) CATALOG_MAP.set(c.id, c)
  for (const c of PROCEDURAL_CATALOG) CATALOG_MAP.set(c.id, c)
  for (const c of remoteModels ?? []) CATALOG_MAP.set(c.id, c)
  for (const c of customItems) CATALOG_MAP.set(c.id, c)
}

rebuildMap()

export const useCatalog = create<CatalogState>(() => ({ items: visibleItems(), status, version: 0 }))

function publish() {
  rebuildMap()
  useCatalog.setState((s) => ({ items: visibleItems(), status, version: s.version + 1 }))
}

export function setRemoteModels(items: CatalogItem[] | null, next: CatalogStatus) {
  remoteModels = items
  status = next
  publish()
}

export function setCustomItems(items: CatalogItem[]) {
  customItems = items
  publish()
}

export function getCatalogItems() {
  return useCatalog.getState().items
}

export function furnitureDims(f: Pick<PlacedFurniture, 'size' | 'scale'>, item: CatalogItem) {
  const s = f.size ?? item.size
  return { width: s.width * f.scale, depth: s.depth * f.scale, height: s.height * f.scale }
}

export function furnitureColors(f: Pick<PlacedFurniture, 'colors'>, item: CatalogItem) {
  return { ...(item.procedural?.colors ?? {}), ...(f.colors ?? {}) }
}

export const CATEGORY_ORDER = ['我的家具', '床', '沙發', '桌', '椅', '櫃', '燈', '家電', '衛浴', '地毯', '植物', '裝飾']

export const MY_CATEGORY = '我的家具'

export function inCategory(c: CatalogItem, category: string) {
  return category === '全部' || (category === MY_CATEGORY ? !!c.custom : c.category === category)
}

export function categoriesOf(items: CatalogItem[]) {
  const set = new Set(items.map((c) => c.category))
  if (items.some((c) => c.custom)) set.add(MY_CATEGORY)
  return [...CATEGORY_ORDER.filter((c) => set.has(c)), ...Array.from(set).filter((c) => !CATEGORY_ORDER.includes(c))]
}

export function stylesOf(items: CatalogItem[]) {
  return Array.from(new Set(items.flatMap((c) => c.styles)))
}

export const CATEGORY_ICON: Record<string, string> = {
  我的家具: '⭐',
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
