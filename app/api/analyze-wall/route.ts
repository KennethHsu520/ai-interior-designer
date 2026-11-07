import { z } from 'zod'
import { AIError, generateWithRetry, getProvider, type ImageInput } from '@/lib/ai/provider'

export const maxDuration = 60

const TYPES = ['door', 'window', 'switch', 'outlet', 'light', 'air_conditioner', 'furniture', 'other'] as const

const RequestSchema = z.object({
  image: z.string().max(8_000_000),
  wallLength: z.number().positive().max(50),
  roomHeight: z.number().positive().max(10),
})

const Box = z.object({ x0: z.number(), x1: z.number(), y0: z.number(), y1: z.number() })

const DetectionSchema = z.object({
  wall: Box,
  items: z.array(
    z.object({
      type: z.enum(TYPES),
      label: z.string(),
      location: z.enum(['wall', 'ceiling']),
      x0: z.number(),
      x1: z.number(),
      y0: z.number(),
      y1: z.number(),
      confidence: z.number(),
    }),
  ),
})

const ValidatedSchema = z.object({
  wall: Box.refine((d) => d.x1 > d.x0 && d.y1 > d.y0),
  items: z.array(
    z
      .object({
        type: z.enum(TYPES),
        label: z.string().min(1).max(40),
        location: z.enum(['wall', 'ceiling']),
        x0: z.number().min(-0.05).max(1.05),
        x1: z.number().min(-0.05).max(1.05),
        y0: z.number().min(-0.05).max(1.05),
        y1: z.number().min(-0.05).max(1.05),
        confidence: z.number().min(0).max(1),
      })
      .refine((d) => d.x1 > d.x0 && d.y1 > d.y0),
  ),
})

const SYSTEM = `你是室內丈量助理。使用者會給你一張室內單面牆的照片，以及這面牆的實際長度與房間高度。
請找出這面牆上的：門(door)、窗(window)、電燈開關(switch)、插座(outlet)、電燈(light)、冷氣(air_conditioner)、靠著這面牆的現有家具(furniture)、其他固定物(other)。
座標規則（非常重要）：
- 所有座標都是「整張照片」的正規化座標：x=0 是照片左緣、x=1 是右緣；y=0 是照片上緣、y=1 是下緣。
- wall 是這面牆在照片中的範圍：x0 為左牆角、x1 為右牆角、y0 為牆與天花板交界、y1 為牆與地板交界（牆角若在畫面外就填 0 或 1）。
- 每個物件的 x0<x1、y0<y1，分別是物件的左、右、上、下邊界，數值介於 0～1。
- 利用已知尺寸檢查合理性：一般門高約 2.0～2.1m、開關離地約 1.2m、插座離地約 0.3m。
- 天花板上的燈或冷氣，location 填 ceiling，照實際在照片中的位置填座標。其餘 location 填 wall。
- label 用繁體中文簡短描述（例如「單開木門」「雙孔插座」「分離式冷氣」）。
- confidence 是 0～1 的把握程度。
- 看不到或不確定的不要亂猜；完全沒有物件就回傳空陣列。`

function parseDataUrl(dataUrl: string): ImageInput {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl)
  if (!m) throw new AIError('照片格式錯誤，請重新上傳', 400)
  return { mediaType: m[1] as ImageInput['mediaType'], base64: m[2] }
}

const MOCK = {
  wall: { x0: 0, x1: 1, y0: 0, y1: 1 },
  items: [
    { type: 'window', label: '鋁窗（示範）', location: 'wall', x0: 0.35, x1: 0.65, y0: 0.25, y1: 0.6, confidence: 0.5 },
    { type: 'outlet', label: '雙孔插座（示範）', location: 'wall', x0: 0.1, x1: 0.14, y0: 0.86, y1: 0.9, confidence: 0.5 },
    { type: 'switch', label: '電燈開關（示範）', location: 'wall', x0: 0.85, x1: 0.89, y0: 0.53, y1: 0.58, confidence: 0.5 },
  ],
} satisfies z.infer<typeof DetectionSchema>

export async function POST(request: Request) {
  let body: z.infer<typeof RequestSchema>
  try {
    body = RequestSchema.parse(await request.json())
  } catch {
    return Response.json({ error: '請求格式錯誤' }, { status: 400 })
  }
  try {
    const image = parseDataUrl(body.image)
    const provider = getProvider()
    if (!provider) return Response.json({ mock: true, ...MOCK })
    const result = await generateWithRetry(
      provider,
      {
        system: SYSTEM,
        prompt: `這面牆實際長度 ${body.wallLength.toFixed(2)} 公尺，房間高度 ${body.roomHeight.toFixed(2)} 公尺。請辨識並以 JSON 回傳。`,
        image,
        schema: DetectionSchema,
      },
      ValidatedSchema,
    )
    const w = result.wall
    const cx = (v: number) => Math.min(1, Math.max(0, (v - w.x0) / (w.x1 - w.x0)))
    const cy = (v: number) => Math.min(1, Math.max(0, (v - w.y0) / (w.y1 - w.y0)))
    const items = result.items
      .map((it) => ({ ...it, x0: cx(it.x0), x1: cx(it.x1), y0: it.location === 'ceiling' ? 0 : cy(it.y0), y1: it.location === 'ceiling' ? 0.02 : cy(it.y1) }))
      .filter((it) => it.x1 - it.x0 > 0.003 && it.y1 > it.y0)
    return Response.json({ mock: false, wall: w, items })
  } catch (e) {
    const err = e instanceof AIError ? e : new AIError('辨識失敗')
    return Response.json({ error: err.message }, { status: err.status })
  }
}
