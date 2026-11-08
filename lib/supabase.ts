'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PUBLIC_URL = 'https://qyajbakbsgxukemyhvcz.supabase.co'
const PUBLIC_KEY = 'sb_publishable_0Nd3vsgEcIvY_xXko3S9Cw_enC-pMsk'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || PUBLIC_URL
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PUBLIC_KEY

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
