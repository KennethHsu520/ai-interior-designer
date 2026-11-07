import { readdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { getBounds } from '@gltf-transform/functions'
import type { CatalogItem } from '../types/room'

const ROOT = process.cwd()
const MODELS = path.join(ROOT, 'public', 'models')

type Meta = { name: string; category: string; styles: string[]; fit: 'width' | 'height' | 'depth'; value: number }

const SOURCES: Record<string, { label: string; license: string }> = {
  kenney: { label: 'Kenney Furniture Kit', license: 'CC0 1.0' },
  kaykit: { label: 'KayKit Furniture Bits', license: 'CC0 1.0' },
  polyhaven: { label: 'Poly Haven', license: 'CC0 1.0' },
}

const KAYKIT: Record<string, Meta> = {
  armchair: { name: '單人沙發', category: '沙發', styles: ['可愛', '現代'], fit: 'width', value: 0.85 },
  armchair_pillows: { name: '單人沙發（抱枕）', category: '沙發', styles: ['可愛', '現代'], fit: 'width', value: 0.85 },
  bed_double_A: { name: '雙人床 A', category: '床', styles: ['可愛', '北歐'], fit: 'depth', value: 2.0 },
  bed_double_B: { name: '雙人床 B', category: '床', styles: ['可愛', '北歐'], fit: 'depth', value: 2.0 },
  bed_single_A: { name: '單人床 A', category: '床', styles: ['可愛', '北歐'], fit: 'depth', value: 2.0 },
  bed_single_B: { name: '單人床 B', category: '床', styles: ['可愛', '北歐'], fit: 'depth', value: 2.0 },
  book_set: { name: '一排書', category: '裝飾', styles: ['可愛'], fit: 'width', value: 0.3 },
  book_single: { name: '書本', category: '裝飾', styles: ['可愛'], fit: 'width', value: 0.18 },
  cabinet_medium: { name: '中型收納櫃', category: '櫃', styles: ['可愛', '北歐'], fit: 'width', value: 0.9 },
  cabinet_medium_decorated: { name: '中型收納櫃（擺飾）', category: '櫃', styles: ['可愛', '北歐'], fit: 'width', value: 0.9 },
  cabinet_small: { name: '小型收納櫃', category: '櫃', styles: ['可愛', '北歐'], fit: 'width', value: 0.5 },
  cabinet_small_decorated: { name: '小型收納櫃（擺飾）', category: '櫃', styles: ['可愛', '北歐'], fit: 'width', value: 0.5 },
  cactus_medium_A: { name: '仙人掌盆栽 A', category: '植物', styles: ['可愛'], fit: 'height', value: 0.6 },
  cactus_medium_B: { name: '仙人掌盆栽 B', category: '植物', styles: ['可愛'], fit: 'height', value: 0.6 },
  cactus_small_A: { name: '小仙人掌 A', category: '植物', styles: ['可愛'], fit: 'height', value: 0.25 },
  cactus_small_B: { name: '小仙人掌 B', category: '植物', styles: ['可愛'], fit: 'height', value: 0.25 },
  chair_A: { name: '餐椅 A', category: '椅', styles: ['可愛', '現代'], fit: 'height', value: 0.85 },
  chair_A_wood: { name: '木餐椅 A', category: '椅', styles: ['可愛', '北歐'], fit: 'height', value: 0.85 },
  chair_B: { name: '餐椅 B', category: '椅', styles: ['可愛', '現代'], fit: 'height', value: 0.85 },
  chair_B_wood: { name: '木餐椅 B', category: '椅', styles: ['可愛', '北歐'], fit: 'height', value: 0.85 },
  chair_C: { name: '餐椅 C', category: '椅', styles: ['可愛', '現代'], fit: 'height', value: 0.85 },
  chair_stool: { name: '圓凳', category: '椅', styles: ['可愛', '現代'], fit: 'height', value: 0.45 },
  chair_stool_wood: { name: '木圓凳', category: '椅', styles: ['可愛', '北歐'], fit: 'height', value: 0.45 },
  couch: { name: '三人沙發', category: '沙發', styles: ['可愛', '現代'], fit: 'width', value: 2.0 },
  couch_pillows: { name: '三人沙發（抱枕）', category: '沙發', styles: ['可愛', '現代'], fit: 'width', value: 2.0 },
  lamp_standing: { name: '立燈', category: '燈', styles: ['可愛', '現代'], fit: 'height', value: 1.6 },
  lamp_table: { name: '桌燈', category: '燈', styles: ['可愛', '現代'], fit: 'height', value: 0.45 },
  pictureframe_large_A: { name: '大掛畫 A', category: '裝飾', styles: ['可愛'], fit: 'width', value: 0.8 },
  pictureframe_large_B: { name: '大掛畫 B', category: '裝飾', styles: ['可愛'], fit: 'width', value: 0.8 },
  pictureframe_medium: { name: '中掛畫', category: '裝飾', styles: ['可愛'], fit: 'width', value: 0.5 },
  pictureframe_small_A: { name: '小相框 A', category: '裝飾', styles: ['可愛'], fit: 'width', value: 0.25 },
  pictureframe_small_B: { name: '小相框 B', category: '裝飾', styles: ['可愛'], fit: 'width', value: 0.25 },
  pictureframe_small_C: { name: '小相框 C', category: '裝飾', styles: ['可愛'], fit: 'width', value: 0.25 },
  pictureframe_standing_A: { name: '立式相框 A', category: '裝飾', styles: ['可愛'], fit: 'width', value: 0.2 },
  pictureframe_standing_B: { name: '立式相框 B', category: '裝飾', styles: ['可愛'], fit: 'width', value: 0.2 },
  pillow_A: { name: '抱枕 A', category: '裝飾', styles: ['可愛'], fit: 'width', value: 0.45 },
  pillow_B: { name: '抱枕 B', category: '裝飾', styles: ['可愛'], fit: 'width', value: 0.45 },
  rug_oval_A: { name: '橢圓地毯 A', category: '地毯', styles: ['可愛', '北歐'], fit: 'width', value: 1.6 },
  rug_oval_B: { name: '橢圓地毯 B', category: '地毯', styles: ['可愛', '北歐'], fit: 'width', value: 1.6 },
  rug_rectangle_A: { name: '長方地毯 A', category: '地毯', styles: ['可愛', '北歐'], fit: 'width', value: 2.0 },
  rug_rectangle_B: { name: '長方地毯 B', category: '地毯', styles: ['可愛', '北歐'], fit: 'width', value: 2.0 },
  rug_rectangle_stripes_A: { name: '條紋地毯 A', category: '地毯', styles: ['可愛', '北歐'], fit: 'width', value: 2.0 },
  rug_rectangle_stripes_B: { name: '條紋地毯 B', category: '地毯', styles: ['可愛', '北歐'], fit: 'width', value: 2.0 },
  shelf_A_big: { name: '層架 A（大）', category: '櫃', styles: ['可愛', '北歐'], fit: 'width', value: 1.0 },
  shelf_A_small: { name: '層架 A（小）', category: '櫃', styles: ['可愛', '北歐'], fit: 'width', value: 0.6 },
  shelf_B_large: { name: '書架 B（大）', category: '櫃', styles: ['可愛', '北歐'], fit: 'width', value: 1.0 },
  shelf_B_large_decorated: { name: '書架 B（大，擺飾）', category: '櫃', styles: ['可愛', '北歐'], fit: 'width', value: 1.0 },
  shelf_B_small: { name: '書架 B（小）', category: '櫃', styles: ['可愛', '北歐'], fit: 'width', value: 0.6 },
  shelf_B_small_decorated: { name: '書架 B（小，擺飾）', category: '櫃', styles: ['可愛', '北歐'], fit: 'width', value: 0.6 },
  table_low: { name: '矮茶几', category: '桌', styles: ['可愛', '北歐'], fit: 'width', value: 1.0 },
  table_medium: { name: '方桌', category: '桌', styles: ['可愛', '北歐'], fit: 'width', value: 1.2 },
  table_medium_long: { name: '長餐桌', category: '桌', styles: ['可愛', '北歐'], fit: 'width', value: 1.8 },
  table_small: { name: '小邊桌', category: '桌', styles: ['可愛', '北歐'], fit: 'width', value: 0.5 },
}

const POLYHAVEN: Record<string, Omit<Meta, 'fit' | 'value'>> = {
  Sofa_01: { name: '布面雙人沙發', category: '沙發', styles: ['寫實', '現代'] },
  sofa_02: { name: '灰色三人沙發', category: '沙發', styles: ['寫實', '現代', '北歐'] },
  sofa_03: { name: '大型 L 沙發', category: '沙發', styles: ['寫實', '現代'] },
  ArmChair_01: { name: '經典扶手椅', category: '沙發', styles: ['寫實', '古典'] },
  modern_arm_chair_01: { name: '現代扶手椅', category: '沙發', styles: ['寫實', '現代'] },
  mid_century_lounge_chair: { name: '中世紀躺椅', category: '沙發', styles: ['寫實', '復古'] },
  Ottoman_01: { name: '腳凳', category: '椅', styles: ['寫實', '現代'] },
  CoffeeTable_01: { name: '木頭茶几', category: '桌', styles: ['寫實', '北歐'] },
  modern_coffee_table_01: { name: '現代長茶几', category: '桌', styles: ['寫實', '現代'] },
  modern_coffee_table_02: { name: '現代方茶几', category: '桌', styles: ['寫實', '現代'] },
  coffee_table_round_01: { name: '圓形茶几', category: '桌', styles: ['寫實', '現代'] },
  side_table_01: { name: '邊桌', category: '桌', styles: ['寫實', '現代'] },
  side_table_tall_01: { name: '高邊桌', category: '桌', styles: ['寫實', '現代'] },
  ClassicNightstand_01: { name: '經典床頭櫃', category: '櫃', styles: ['寫實', '古典'] },
  painted_wooden_nightstand: { name: '彩繪床頭櫃', category: '櫃', styles: ['寫實', '鄉村'] },
  old_bed_frame: { name: '鐵架單人床', category: '床', styles: ['寫實', '工業'] },
  GothicBed_01: { name: '歌德式雙人床', category: '床', styles: ['寫實', '古典'] },
  vintage_day_bed: { name: '復古臥榻', category: '床', styles: ['寫實', '復古'] },
  Shelf_01: { name: '開放層架', category: '櫃', styles: ['寫實', '現代'] },
  wooden_bookshelf_worn: { name: '舊木書櫃', category: '櫃', styles: ['寫實', '鄉村'] },
  drawer_cabinet: { name: '抽屜櫃', category: '櫃', styles: ['寫實', '工業'] },
  modern_wooden_cabinet: { name: '現代電視櫃', category: '櫃', styles: ['寫實', '現代', '北歐'] },
  painted_wooden_cabinet: { name: '彩繪矮櫃', category: '櫃', styles: ['寫實', '鄉村'] },
  metal_office_desk: { name: '金屬辦公桌', category: '桌', styles: ['寫實', '工業'] },
  SchoolDesk_01: { name: '學生書桌', category: '桌', styles: ['寫實', '復古'] },
  dining_chair_02: { name: '餐椅', category: '椅', styles: ['寫實', '現代'] },
  round_wooden_table_02: { name: '小圓木桌', category: '桌', styles: ['寫實', '北歐'] },
  dining_table: { name: '長餐桌', category: '桌', styles: ['寫實', '工業'] },
  bar_chair_round_01: { name: '圓形吧台椅', category: '椅', styles: ['寫實', '現代'] },
  chinese_tea_table: { name: '中式茶几', category: '桌', styles: ['寫實', '中式'] },
  chinese_armchair: { name: '中式官帽椅', category: '椅', styles: ['寫實', '中式'] },
  ornate_mirror_01: { name: '雕花鏡子', category: '裝飾', styles: ['寫實', '古典'] },
}

const KENNEY_RULES: { test: RegExp; meta: Omit<Meta, 'name'>; name: string }[] = [
  { test: /^bedDouble/i, name: '雙人床', meta: { category: '床', styles: ['簡約'], fit: 'width', value: 1.6 } },
  { test: /^bedSingle/i, name: '單人床', meta: { category: '床', styles: ['簡約'], fit: 'width', value: 1.0 } },
  { test: /^bedBunk/i, name: '雙層床', meta: { category: '床', styles: ['簡約'], fit: 'width', value: 1.0 } },
  { test: /^loungeSofaCorner/i, name: 'L 型沙發', meta: { category: '沙發', styles: ['簡約'], fit: 'width', value: 2.2 } },
  { test: /^loungeSofaLong/i, name: '長沙發', meta: { category: '沙發', styles: ['簡約'], fit: 'width', value: 2.4 } },
  { test: /^loungeSofaOttoman/i, name: '沙發腳凳', meta: { category: '沙發', styles: ['簡約'], fit: 'width', value: 0.8 } },
  { test: /^loungeSofa/i, name: '沙發', meta: { category: '沙發', styles: ['簡約'], fit: 'width', value: 2.0 } },
  { test: /^loungeChair/i, name: '單人沙發', meta: { category: '沙發', styles: ['簡約'], fit: 'width', value: 0.85 } },
  { test: /^loungeDesignSofa/i, name: '設計沙發', meta: { category: '沙發', styles: ['簡約', '現代'], fit: 'width', value: 2.0 } },
  { test: /^loungeDesignChair/i, name: '設計單椅', meta: { category: '沙發', styles: ['簡約', '現代'], fit: 'width', value: 0.85 } },
  { test: /^chairDesk/i, name: '辦公椅', meta: { category: '椅', styles: ['簡約'], fit: 'height', value: 1.0 } },
  { test: /^chair/i, name: '椅子', meta: { category: '椅', styles: ['簡約'], fit: 'height', value: 0.85 } },
  { test: /^stool/i, name: '凳子', meta: { category: '椅', styles: ['簡約'], fit: 'height', value: 0.6 } },
  { test: /^benchCushion/i, name: '軟墊長椅', meta: { category: '椅', styles: ['簡約'], fit: 'width', value: 1.2 } },
  { test: /^bench/i, name: '長椅', meta: { category: '椅', styles: ['簡約'], fit: 'width', value: 1.2 } },
  { test: /^desk/i, name: '書桌', meta: { category: '桌', styles: ['簡約'], fit: 'width', value: 1.2 } },
  { test: /^tableCoffee/i, name: '茶几', meta: { category: '桌', styles: ['簡約'], fit: 'width', value: 1.0 } },
  { test: /^tableRound/i, name: '圓桌', meta: { category: '桌', styles: ['簡約'], fit: 'width', value: 0.9 } },
  { test: /^sideTable/i, name: '邊桌', meta: { category: '桌', styles: ['簡約'], fit: 'width', value: 0.5 } },
  { test: /^table/i, name: '桌子', meta: { category: '桌', styles: ['簡約'], fit: 'width', value: 1.2 } },
  { test: /^bookcase/i, name: '書櫃', meta: { category: '櫃', styles: ['簡約'], fit: 'width', value: 0.8 } },
  { test: /^cabinetBed/i, name: '床頭櫃', meta: { category: '櫃', styles: ['簡約'], fit: 'width', value: 0.5 } },
  { test: /^cabinetTelevision/i, name: '電視櫃', meta: { category: '櫃', styles: ['簡約'], fit: 'width', value: 1.6 } },
  { test: /^kitchenFridge/i, name: '冰箱', meta: { category: '家電', styles: ['簡約'], fit: 'height', value: 1.8 } },
  { test: /^kitchen/i, name: '廚房櫃', meta: { category: '櫃', styles: ['簡約'], fit: 'height', value: 0.9 } },
  { test: /^televisionModern/i, name: '電視', meta: { category: '家電', styles: ['簡約'], fit: 'width', value: 1.2 } },
  { test: /^television/i, name: '電視', meta: { category: '家電', styles: ['簡約'], fit: 'width', value: 0.9 } },
  { test: /^washer|^dryer/i, name: '洗衣機', meta: { category: '家電', styles: ['簡約'], fit: 'height', value: 0.85 } },
  { test: /^lamp/i, name: '燈', meta: { category: '燈', styles: ['簡約'], fit: 'height', value: 1.5 } },
  { test: /^plant|^pottedPlant/i, name: '盆栽', meta: { category: '植物', styles: ['簡約'], fit: 'height', value: 0.8 } },
  { test: /^rug/i, name: '地毯', meta: { category: '地毯', styles: ['簡約'], fit: 'width', value: 2.0 } },
  { test: /^coatRack/i, name: '衣帽架', meta: { category: '裝飾', styles: ['簡約'], fit: 'height', value: 1.7 } },
  { test: /^bathtub/i, name: '浴缸', meta: { category: '衛浴', styles: ['簡約'], fit: 'width', value: 1.6 } },
  { test: /^toilet/i, name: '馬桶', meta: { category: '衛浴', styles: ['簡約'], fit: 'height', value: 0.75 } },
  { test: /^bathroomSink/i, name: '洗手台', meta: { category: '衛浴', styles: ['簡約'], fit: 'height', value: 0.85 } },
  { test: /^speaker/i, name: '音響', meta: { category: '家電', styles: ['簡約'], fit: 'height', value: 1.0 } },
  { test: /^computer|^laptop/i, name: '電腦', meta: { category: '家電', styles: ['簡約'], fit: 'width', value: 0.5 } },
  { test: /^books/i, name: '書本', meta: { category: '裝飾', styles: ['簡約'], fit: 'width', value: 0.3 } },
  { test: /^pillow/i, name: '抱枕', meta: { category: '裝飾', styles: ['簡約'], fit: 'width', value: 0.45 } },
]

function kenneyMeta(base: string): Meta | null {
  const rule = KENNEY_RULES.find((r) => r.test.test(base))
  if (!rule) return null
  return { name: `${rule.name}（${base}）`, ...rule.meta }
}

const r3 = (n: number) => Math.round(n * 1000) / 1000

async function main() {
  const io = new NodeIO()
  const items: CatalogItem[] = []
  const phMetaPath = path.join(ROOT, 'data', 'polyhaven-meta.json')
  const phMeta: Record<string, { dimensions?: number[] }> = existsSync(phMetaPath) ? JSON.parse(await readFile(phMetaPath, 'utf8')) : {}

  for (const source of Object.keys(SOURCES)) {
    const dir = path.join(MODELS, source)
    if (!existsSync(dir)) continue
    const files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.glb')).sort()
    for (const f of files) {
      const base = f.replace(/\.glb$/i, '')
      const doc = await io.read(path.join(dir, f))
      const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]
      const { min, max } = getBounds(scene)
      const raw = { width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] }
      let meta: Meta | null = null
      let scale = 1
      if (source === 'kaykit') meta = KAYKIT[base] ?? null
      if (source === 'kenney') meta = kenneyMeta(base)
      if (source === 'polyhaven') {
        const m = POLYHAVEN[base]
        const dims = phMeta[base]?.dimensions
        if (m) {
          const realH = dims ? dims[2] / 1000 : raw.height
          meta = { ...m, fit: 'height', value: realH }
        }
      }
      if (!meta) {
        console.warn('skip (no metadata)', source, f)
        continue
      }
      const rawFit = raw[meta.fit] || 1
      scale = meta.value / rawFit
      items.push({
        id: `${source}/${base}`,
        name: meta.name,
        category: meta.category,
        styles: meta.styles,
        source: SOURCES[source].label,
        license: SOURCES[source].license,
        file: `/models/${source}/${f}`,
        size: { width: r3(raw.width * scale), depth: r3(raw.depth * scale), height: r3(raw.height * scale) },
        rawSize: { width: r3(raw.width), depth: r3(raw.depth), height: r3(raw.height) },
        rawMin: { x: r3(min[0]), y: r3(min[1]), z: r3(min[2]) },
        scale: Math.round(scale * 10000) / 10000,
      })
    }
  }
  await writeFile(path.join(ROOT, 'data', 'catalog.json'), JSON.stringify(items, null, 2) + '\n')
  console.log(`catalog: ${items.length} items`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
