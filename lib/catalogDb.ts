import type { CatalogItem } from '@/types/room'

export type FurnitureRow = {
  id: string
  name: string
  category: string
  styles: string[]
  source: string
  license: string
  author: string | null
  source_url: string | null
  file_path: string
  thumbnail_path: string | null
  size: CatalogItem['size']
  raw_size: CatalogItem['rawSize']
  raw_min: CatalogItem['rawMin']
  scale: number
  procedural: CatalogItem['procedural'] | null
  published: boolean
  sort_order: number
}

export const SOURCE_INFO: Record<string, { author: string; url: string }> = {
  'KayKit Furniture Bits': { author: 'Kay Lousberg', url: 'https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0' },
  'Poly Haven': { author: 'Poly Haven', url: 'https://polyhaven.com/models' },
  'Kenney Furniture Kit': { author: 'Kenney', url: 'https://kenney.nl/assets/furniture-kit' },
}

export function rowToItem(r: FurnitureRow): CatalogItem {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    styles: r.styles ?? [],
    source: r.source,
    license: r.license,
    author: r.author ?? undefined,
    sourceUrl: r.source_url ?? undefined,
    file: r.file_path,
    thumbnail: r.thumbnail_path ?? undefined,
    size: r.size,
    rawSize: r.raw_size,
    rawMin: r.raw_min,
    scale: r.scale,
    procedural: r.procedural ?? undefined,
    published: r.published,
  }
}

export function itemToRow(item: CatalogItem, sortOrder: number): FurnitureRow {
  const info = SOURCE_INFO[item.source]
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    styles: item.styles,
    source: item.source,
    license: item.license,
    author: item.author ?? info?.author ?? null,
    source_url: item.sourceUrl ?? info?.url ?? null,
    file_path: item.file,
    thumbnail_path: item.thumbnail ?? null,
    size: item.size,
    raw_size: item.rawSize,
    raw_min: item.rawMin,
    scale: item.scale,
    procedural: item.procedural ?? null,
    published: item.published ?? true,
    sort_order: sortOrder,
  }
}

export const FURNITURE_COLUMNS =
  'id,name,category,styles,source,license,author,source_url,file_path,thumbnail_path,size,raw_size,raw_min,scale,procedural,published,sort_order'
