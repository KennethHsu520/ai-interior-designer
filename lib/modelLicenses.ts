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
    name: 'TripoSR（ONNX WebGPU 版）',
    use: '「我的家具」實驗功能：從照片生成 3D 形狀',
    author: 'Stability AI 與 Tripo AI；ONNX 轉換：cgb',
    license: 'MIT License',
    url: 'https://huggingface.co/cgb/triposr-onnx-webgpu',
    note: '原始模型 stabilityai/TripoSR（MIT）；圖中內含的 DINO ViT-B/16 影像編碼器為 Apache License 2.0。只在使用者同意下載後於瀏覽器以 WebGPU 執行。',
  },
  {
    name: 'U²-Net（U-2-Netp）',
    use: '從照片生成 3D 形狀前的去背',
    author: 'Xuebin Qin 等；ONNX：rembg、BritishWerewolf',
    license: 'Apache License 2.0',
    url: 'https://huggingface.co/BritishWerewolf/U-2-Netp',
    note: '輕量版去背模型（約 5 MB），在瀏覽器以 WebAssembly 執行。',
  },
  {
    name: 'ONNX Runtime Web',
    use: '在瀏覽器中執行 3D 生成與去背模型',
    author: 'Microsoft',
    license: 'MIT License',
    url: 'https://github.com/microsoft/onnxruntime',
    note: '開源函式庫，由 jsDelivr CDN 載入。',
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
