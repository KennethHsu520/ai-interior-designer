export type ModelLicense = { name: string; use: string; author: string; license: string; url: string; note: string }

export const MODEL_LICENSES: ModelLicense[] = [
  {
    name: 'OWLv2（owlv2-base-patch16-ensemble）',
    use: '牆面照片「自動找找看」',
    author: 'Google Research；ONNX 轉換：Xenova',
    license: 'Apache License 2.0',
    url: 'https://huggingface.co/google/owlv2-base-patch16-ensemble',
    note: '使用 Xenova/owlv2-base-patch16-ensemble 的 ONNX 權重，透過 Transformers.js 只在使用者瀏覽器中執行，照片不會上傳。',
  },
  {
    name: 'Transformers.js',
    use: '在瀏覽器中執行 AI 模型',
    author: 'Hugging Face',
    license: 'Apache License 2.0',
    url: 'https://github.com/huggingface/transformers.js',
    note: '開源函式庫。',
  },
]
