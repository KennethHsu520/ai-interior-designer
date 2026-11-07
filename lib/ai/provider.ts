import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { z } from 'zod'

export type ImageInput = { mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; base64: string }

export type JSONRequest<T extends z.ZodType> = {
  system: string
  prompt: string
  image?: ImageInput
  schema: T
}

export type AIProvider = {
  name: string
  generateJSON<T extends z.ZodType>(req: JSONRequest<T>): Promise<z.infer<T>>
}

export class AIError extends Error {
  constructor(message: string, public status = 502) {
    super(message)
  }
}

function anthropicProvider(apiKey: string, model: string): AIProvider {
  const client = new Anthropic({ apiKey })
  return {
    name: `anthropic:${model}`,
    async generateJSON(req) {
      const content: Anthropic.Beta.BetaContentBlockParam[] = []
      if (req.image) content.push({ type: 'image', source: { type: 'base64', media_type: req.image.mediaType, data: req.image.base64 } })
      content.push({ type: 'text', text: req.prompt })
      try {
        const res = await client.beta.messages.parse({
          model,
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: req.system,
          output_config: { effort: 'medium', format: betaZodOutputFormat(req.schema) },
          messages: [{ role: 'user', content }],
        })
        if (res.stop_reason === 'refusal') throw new AIError('AI 拒絕處理這個請求，請換一張照片或換個說法')
        if (res.stop_reason === 'max_tokens') throw new AIError('AI 回應過長被截斷')
        if (res.parsed_output == null) throw new AIError('AI 回傳的 JSON 格式不正確')
        return res.parsed_output as z.infer<typeof req.schema>
      } catch (e) {
        if (e instanceof AIError) throw e
        if (e instanceof Anthropic.AuthenticationError) throw new AIError('AI_API_KEY 無效', 401)
        if (e instanceof Anthropic.RateLimitError) throw new AIError('AI 呼叫太頻繁，請稍後再試', 429)
        if (e instanceof Anthropic.BadRequestError) throw new AIError(`AI 請求錯誤：${e.message}`, 400)
        if (e instanceof Anthropic.APIError) throw new AIError(`AI 服務錯誤（${e.status}）`, 502)
        throw new AIError('無法連線到 AI 服務')
      }
    },
  }
}

export function getProvider(): AIProvider | null {
  const provider = (process.env.AI_PROVIDER || 'anthropic').toLowerCase()
  const key = process.env.AI_API_KEY
  if (provider === 'mock' || !key) return null
  if (provider === 'anthropic') return anthropicProvider(key, process.env.AI_MODEL || 'claude-opus-5-5')
  throw new AIError(`不支援的 AI_PROVIDER：${provider}`, 500)
}

export async function generateWithRetry<T extends z.ZodType>(provider: AIProvider, req: JSONRequest<T>, validate: T): Promise<z.infer<T>> {
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await provider.generateJSON(req)
      const parsed = validate.safeParse(out)
      if (parsed.success) return parsed.data
      lastError = new AIError('AI 回傳的資料未通過驗證')
    } catch (e) {
      lastError = e
      if (e instanceof AIError && [400, 401, 429].includes(e.status)) break
    }
  }
  throw lastError instanceof AIError ? lastError : new AIError('AI 處理失敗')
}
