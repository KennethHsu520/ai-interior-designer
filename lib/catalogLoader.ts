'use client'

import { useEffect } from 'react'
import type { CatalogItem } from '@/types/room'
import { setRemoteModels } from './catalog'
import { FURNITURE_COLUMNS, rowToItem, type FurnitureRow } from './catalogDb'
import { getSupabase } from './supabase'
import { loadCustomFurniture } from './customFurniture'

const CACHE_KEY = 'furniture-catalog-cache-v1'
const TIMEOUT_MS = 8000

let started: Promise<void> | null = null

function readCache(): CatalogItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { items: CatalogItem[] }
    return Array.isArray(parsed.items) && parsed.items.length ? parsed.items : null
  } catch {
    return null
  }
}

function writeCache(items: CatalogItem[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items }))
  } catch {}
}

export async function fetchRemoteCatalog(includeHidden = false): Promise<CatalogItem[]> {
  const sb = getSupabase()
  if (!sb) throw new Error('未設定 Supabase')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    let q = sb.from('furniture').select(FURNITURE_COLUMNS).order('sort_order').order('id').abortSignal(controller.signal)
    if (!includeHidden) q = q.eq('published', true)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return (data as unknown as FurnitureRow[]).map(rowToItem)
  } finally {
    clearTimeout(timer)
  }
}

export function loadCatalog(force = false) {
  if (started && !force) return started
  started = (async () => {
    if (!getSupabase()) {
      setRemoteModels(null, 'unconfigured')
      return
    }
    const cached = readCache()
    if (cached && !force) setRemoteModels(cached, 'cached')
    try {
      const items = await fetchRemoteCatalog()
      if (!items.length) throw new Error('empty')
      writeCache(items)
      setRemoteModels(items, 'online')
    } catch {
      setRemoteModels(null, 'offline')
    }
  })()
  return started
}

export function useCatalogLoader() {
  useEffect(() => {
    loadCatalog()
    loadCustomFurniture()
  }, [])
}
