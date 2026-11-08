'use client'

import { create } from 'zustand'
import type { CatalogItem } from '@/types/room'
import { setCustomItems } from './catalog'
import { deletePhoto, PHOTO_PREFIX } from './image'
import { KINDS, PROCEDURAL_CATALOG } from './procedural'

export type CustomFurniture = {
  id: string
  name: string
  kind: string
  size: { width: number; depth: number; height: number }
  colors: Record<string, string>
  photoRef?: string
  modelRef?: string
  createdAt: number
}

export const CUSTOM_PREFIX = 'custom_'
export const CUSTOM_SOURCE = '我的家具（自己做的）'

const DB_NAME = 'ai-interior-custom'
const STORE = 'furniture'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function kindOf(kind: string) {
  return KINDS.find((k) => k.kind === kind)
}

export function defaultColors(kind: string): Record<string, string> {
  const sample = PROCEDURAL_CATALOG.find((c) => c.procedural?.kind === kind)
  return { ...(sample?.procedural?.colors ?? {}) }
}

export function customToItem(c: CustomFurniture): CatalogItem {
  const k = kindOf(c.kind)
  return {
    id: c.id,
    name: c.name,
    category: k?.category ?? '裝飾',
    styles: ['我的家具'],
    source: CUSTOM_SOURCE,
    license: '個人使用',
    file: c.modelRef ?? '',
    size: c.size,
    rawSize: c.size,
    rawMin: { x: -c.size.width / 2, y: 0, z: -c.size.depth / 2 },
    scale: 1,
    procedural: c.modelRef ? undefined : { kind: c.kind, colors: c.colors },
    custom: true,
  }
}

type CustomState = { list: CustomFurniture[]; loaded: boolean }

export const useCustomFurniture = create<CustomState>(() => ({ list: [], loaded: false }))

function publish(list: CustomFurniture[]) {
  const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt)
  useCustomFurniture.setState({ list: sorted, loaded: true })
  setCustomItems(sorted.map(customToItem))
}

let loading: Promise<void> | null = null

export function loadCustomFurniture() {
  if (!loading)
    loading = (async () => {
      try {
        publish(await tx<CustomFurniture[]>('readonly', (s) => s.getAll() as IDBRequest<CustomFurniture[]>))
      } catch {
        publish([])
      }
    })()
  return loading
}

export async function saveCustomFurniture(c: CustomFurniture) {
  await tx('readwrite', (s) => s.put(c))
  const rest = useCustomFurniture.getState().list.filter((x) => x.id !== c.id)
  publish([...rest, c])
}

export async function saveManyCustomFurniture(items: CustomFurniture[]) {
  for (const c of items) await tx('readwrite', (s) => s.put(c))
  const ids = new Set(items.map((c) => c.id))
  publish([...useCustomFurniture.getState().list.filter((x) => !ids.has(x.id)), ...items])
}

export async function deleteCustomFurniture(id: string) {
  const c = useCustomFurniture.getState().list.find((x) => x.id === id)
  await tx('readwrite', (s) => s.delete(id))
  if (c?.photoRef?.startsWith(PHOTO_PREFIX)) await deletePhoto(c.photoRef)
  if (c?.modelRef?.startsWith(PHOTO_PREFIX)) await deletePhoto(c.modelRef)
  publish(useCustomFurniture.getState().list.filter((x) => x.id !== id))
}

export function getCustomFurniture(id: string) {
  return useCustomFurniture.getState().list.find((x) => x.id === id)
}
