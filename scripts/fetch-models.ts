import { mkdir, readdir, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { NodeIO } from '@gltf-transform/core'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'public', 'models')
const UA = 'ai-interior-designer-catalog-script'

export const POLYHAVEN_IDS = [
  'Sofa_01',
  'sofa_02',
  'sofa_03',
  'ArmChair_01',
  'modern_arm_chair_01',
  'mid_century_lounge_chair',
  'Ottoman_01',
  'CoffeeTable_01',
  'modern_coffee_table_01',
  'modern_coffee_table_02',
  'coffee_table_round_01',
  'side_table_01',
  'side_table_tall_01',
  'ClassicNightstand_01',
  'painted_wooden_nightstand',
  'old_bed_frame',
  'GothicBed_01',
  'vintage_day_bed',
  'Shelf_01',
  'wooden_bookshelf_worn',
  'drawer_cabinet',
  'modern_wooden_cabinet',
  'painted_wooden_cabinet',
  'metal_office_desk',
  'SchoolDesk_01',
  'dining_chair_02',
  'round_wooden_table_02',
  'dining_table',
  'bar_chair_round_01',
  'chinese_tea_table',
  'chinese_armchair',
  'ornate_mirror_01',
]

async function convertGltf(src: string, dest: string) {
  const io = new NodeIO()
  const doc = await io.read(src)
  await io.write(dest, doc)
}

async function kaykit(dir: string) {
  const out = path.join(OUT, 'kaykit')
  await mkdir(out, { recursive: true })
  const files = (await readdir(dir)).filter((f) => f.endsWith('.gltf'))
  for (const f of files) {
    const dest = path.join(out, f.replace(/\.gltf$/, '.glb'))
    await convertGltf(path.join(dir, f), dest)
    console.log('kaykit', f)
  }
}

async function download(url: string, dest: string) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  await mkdir(path.dirname(dest), { recursive: true })
  await writeFile(dest, Buffer.from(await res.arrayBuffer()))
}

type PhFile = { url: string; include?: Record<string, { url: string }> }

async function polyhaven() {
  const out = path.join(OUT, 'polyhaven')
  await mkdir(out, { recursive: true })
  const meta: Record<string, { name: string; dimensions?: number[] }> = await (
    await fetch('https://api.polyhaven.com/assets?t=models', { headers: { 'User-Agent': UA } })
  ).json()
  const dims: Record<string, { name: string; dimensions?: number[] }> = {}
  for (const id of POLYHAVEN_IDS) {
    const dest = path.join(out, `${id}.glb`)
    dims[id] = { name: meta[id]?.name ?? id, dimensions: meta[id]?.dimensions }
    if (existsSync(dest)) continue
    const files = await (await fetch(`https://api.polyhaven.com/files/${id}`, { headers: { 'User-Agent': UA } })).json()
    const g: PhFile | undefined = files?.gltf?.['1k']?.gltf
    if (!g) {
      console.warn('skip', id)
      continue
    }
    const tmp = path.join(os.tmpdir(), `ph_${id}`)
    await rm(tmp, { recursive: true, force: true })
    const main = path.join(tmp, path.basename(new URL(g.url).pathname))
    await download(g.url, main)
    for (const [rel, f] of Object.entries(g.include ?? {})) await download(f.url, path.join(tmp, rel))
    await convertGltf(main, dest)
    await rm(tmp, { recursive: true, force: true })
    console.log('polyhaven', id)
  }
  await writeFile(path.join(ROOT, 'data', 'polyhaven-meta.json'), JSON.stringify(dims, null, 2))
}

async function main() {
  const kaykitDir = process.argv[2]
  if (kaykitDir) await kaykit(kaykitDir)
  await polyhaven()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
