'use client'

import type { CatalogItem } from '@/types/room'
import { itemToRow, type FurnitureRow } from './catalogDb'
import { getSupabase, MODEL_BUCKET } from './supabase'

const LONG_CACHE = '31536000'

function sb() {
  const c = getSupabase()
  if (!c) throw new Error('尚未設定 Supabase')
  return c
}

export async function isAdmin(userId: string) {
  const { data, error } = await sb().from('admins').select('user_id').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return !!data
}

async function upload(path: string, body: Blob, contentType: string) {
  const store = sb().storage.from(MODEL_BUCKET)
  const { error } = await store.upload(path, body, { cacheControl: LONG_CACHE, contentType, upsert: false })
  if (error && !/exists|duplicate/i.test(error.message)) throw new Error(`上傳失敗：${error.message}`)
  return store.getPublicUrl(path).data.publicUrl
}

export async function uploadAssets(hash: string, glb: Uint8Array, thumbnail: Blob) {
  const model = await upload(`furniture/${hash}.glb`, new Blob([glb.slice()], { type: 'model/gltf-binary' }), 'model/gltf-binary')
  const thumb = await upload(`thumbs/${hash}.png`, thumbnail, 'image/png')
  return { model, thumb }
}

export async function insertFurniture(item: CatalogItem, sortOrder: number) {
  const { error } = await sb().from('furniture').insert(itemToRow(item, sortOrder))
  if (error) throw new Error(error.message)
}

export async function updateFurniture(id: string, patch: Partial<FurnitureRow>) {
  const { error } = await sb().from('furniture').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

function storagePath(url: string | undefined) {
  if (!url) return null
  const marker = `/storage/v1/object/public/${MODEL_BUCKET}/`
  const i = url.indexOf(marker)
  return i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null
}

export async function deleteFurniture(item: CatalogItem) {
  const { error } = await sb().from('furniture').delete().eq('id', item.id)
  if (error) throw new Error(error.message)
  const paths = [storagePath(item.file), storagePath(item.thumbnail)].filter((p): p is string => !!p)
  if (paths.length) await sb().storage.from(MODEL_BUCKET).remove(paths)
}
