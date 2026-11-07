import { z } from 'zod'
import { AIError, generateWithRetry, getProvider } from '@/lib/ai/provider'
import { CATALOG_MAP, furnitureDims } from '@/lib/catalog'
import { describeRoomForAI, heuristicLayout } from '@/lib/layout'
import { validateFloor } from '@/lib/geometry'
import type { PlacedFurniture, Room } from '@/types/room'

export const maxDuration = 60

const Vec = z.object({ x: z.number(), z: z.number() })
const ItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  offset: z.number(),
  elevation: z.number(),
  width: z.number(),
  height: z.number(),
  confirmed: z.boolean(),
})

const RequestSchema = z.object({
  room: z.object({
    id: z.string(),
    name: z.string(),
    floor: z.array(Vec).min(3).max(64),
    height: z.number(),
    walls: z.array(z.object({ id: z.string(), index: z.number(), items: z.array(ItemSchema) })),
    ceilingItems: z.array(ItemSchema),
  }),
  furniture: z
    .array(
      z.object({
        id: z.string(),
        catalogId: z.string(),
        position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
        rotationY: z.number(),
        scale: z.number(),
      }),
    )
    .min(1)
    .max(40),
  message: z.string().max(1000).optional(),
  mode: z.enum(['auto', 'adjust']),
})

const OutputSchema = z.object({
  placements: z.array(z.object({ id: z.string(), x: z.number(), z: z.number(), rotationY: z.number() })),
  explanation: z.string(),
})

const SYSTEM = `你是專業室內設計師，負責在 2D 俯視平面上擺放家具。
座標系：單位公尺，房間地板多邊形在 x-z 平面，y 軸朝上。
每件家具的 x、z 是它俯視外框的中心點。家具本地座標：寬(width)沿本地 x 軸、深(depth)沿本地 z 軸，正面朝本地 +z。
rotationY 是繞 y 軸的弧度，旋轉後正面方向為 (sin(rotationY), cos(rotationY))（x, z 分量）。
每面牆提供 facingIntoRoomRotationY：把家具設成這個角度，正面就會朝向房間內部、背面貼著該牆。
貼牆擺放時，中心點 = 牆上某點 + inwardNormal × (depth/2 + 0.02)。
規則：
- 家具必須完全在房間多邊形內，不可互相重疊（地毯、裝飾除外）。
- 門前方約 1 公尺、與門同寬的範圍要淨空，讓門可以打開。
- 床頭、沙發背、櫃子通常靠牆；床頭不要擋住窗戶；書桌適合靠窗；留至少 0.6 公尺走道。
- 尊重使用者的文字需求。
- 每一件家具都要輸出一筆，id 必須與輸入相同。
- explanation 用一句繁體中文說明這次的配置或改了什麼。`

export async function POST(request: Request) {
  let body: z.infer<typeof RequestSchema>
  try {
    body = RequestSchema.parse(await request.json())
  } catch {
    return Response.json({ error: '請求格式錯誤' }, { status: 400 })
  }
  const room = body.room as Room
  if (validateFloor(room.floor).length) return Response.json({ error: '房間格局不正確' }, { status: 400 })
  const list = body.furniture.filter((f) => CATALOG_MAP.has(f.catalogId)) as PlacedFurniture[]
  if (!list.length) return Response.json({ error: '沒有可擺放的家具' }, { status: 400 })

  try {
    const provider = getProvider()
    if (!provider) {
      const r = heuristicLayout(room, list, CATALOG_MAP)
      return Response.json({
        mock: true,
        placements: r.list.map((f) => ({ id: f.id, x: f.position.x, z: f.position.z, rotationY: f.rotationY })),
        explanation: body.mode === 'adjust' ? '目前為示範模式（未設定 AI_API_KEY），無法理解文字需求，已用內建規則重新排列。' : '示範模式：已用內建規則沿牆排列家具。',
      })
    }
    const furniture = list.map((f) => {
      const c = CATALOG_MAP.get(f.catalogId)!
      return {
        id: f.id,
        name: c.name,
        category: c.category,
        styles: c.styles,
        width: +furnitureDims(f, c).width.toFixed(2),
        depth: +furnitureDims(f, c).depth.toFixed(2),
        height: +furnitureDims(f, c).height.toFixed(2),
        current: body.mode === 'adjust' ? { x: +f.position.x.toFixed(2), z: +f.position.z.toFixed(2), rotationY: +f.rotationY.toFixed(3) } : undefined,
      }
    })
    const prompt = [
      `房間資料：${JSON.stringify(describeRoomForAI(room))}`,
      `家具清單：${JSON.stringify(furniture)}`,
      body.mode === 'adjust' ? '請依照使用者的需求調整目前配置（current 為目前位置）。' : '請為這些家具產生合理的初始配置。',
      `使用者需求：${body.message?.trim() || '無特別需求，請做出舒適實用的配置。'}`,
    ].join('\n\n')
    const out = await generateWithRetry(provider, { system: SYSTEM, prompt, schema: OutputSchema }, OutputSchema)
    const ids = new Set(list.map((f) => f.id))
    return Response.json({
      mock: false,
      placements: out.placements.filter((p) => ids.has(p.id) && Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.rotationY)),
      explanation: out.explanation,
    })
  } catch (e) {
    const err = e instanceof AIError ? e : new AIError('配置失敗')
    return Response.json({ error: err.message }, { status: err.status })
  }
}
