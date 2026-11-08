'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let client: SupabaseClient | null = null

export function supabaseConfigured() {
  return !!URL && !!KEY
}

export function getSupabase() {
  if (!URL || !KEY) return null
  if (!client) client = createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  return client
}

export const MODEL_BUCKET = 'models'
