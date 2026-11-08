import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { CatalogItem } from '../types/room'
import { itemToRow, type FurnitureRow } from '../lib/catalogDb'

const ROOT = process.cwd()

async function loadEnv() {
  try {
    const text = await readFile(path.join(ROOT, '.env.local'), 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
  } catch {}
}

const literal = (v: unknown): string => {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (Array.isArray(v)) return `array[${v.map((x) => literal(x)).join(',')}]::text[]`
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
  return `'${String(v).replace(/'/g, "''")}'`
}

function toSql(rows: FurnitureRow[]) {
  const cols = Object.keys(rows[0]) as (keyof FurnitureRow)[]
  const values = rows.map((r) => `(${cols.map((c) => literal(r[c])).join(', ')})`).join(',\n')
  const updates = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')
  return `insert into public.furniture (${cols.join(', ')}) values\n${values}\non conflict (id) do update set ${updates};\n`
}

async function main() {
  await loadEnv()
  const items = JSON.parse(await readFile(path.join(ROOT, 'data', 'catalog.json'), 'utf8')) as CatalogItem[]
  const rows = items.map((item, i) => itemToRow(item, i * 10))
  if (process.argv.includes('--sql')) {
    process.stdout.write(toSql(rows))
    return
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('請在 .env.local 設定 NEXT_PUBLIC_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY（或用 --sql 產生 SQL 貼到 Supabase SQL Editor）')
    process.exit(1)
  }
  const sb = createClient(url, key, { auth: { persistSession: false } })
  const { error } = await sb.from('furniture').upsert(rows, { onConflict: 'id' })
  if (error) {
    console.error('寫入失敗：', error.message)
    process.exit(1)
  }
  console.log(`已寫入 ${rows.length} 件家具`)
}

main()
