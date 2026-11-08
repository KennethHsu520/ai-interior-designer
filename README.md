# AI室內設計師

上傳家裡每一面牆的照片，建立正確的 3D 房間格局，再從大量家具中挑選，自己擺放或讓 AI 幫你配置。

## 功能
- 3D 空白房間，輸入真實尺寸（長、寬、高），或在 2D 俯視圖拖曳頂點做出 L 型等格局
- 點擊牆面拍照，AI 辨識門、窗、開關、插座、電燈、冷氣與現有家具
- 在立面圖或 3D 中拖曳、縮放、改類型、刪除、新增，逐面牆確認
- 家具素材庫 85 件（CC0 授權），可依分類、風格篩選與搜尋
- 手動拖曳擺放（碰撞檢查：穿牆、重疊、擋門會變紅）／AI 自動配置／用文字跟 AI 討論調整
- 自動存到瀏覽器，可匯出／匯入房間 JSON（含照片）

## 開始使用
```bash
npm install
cp .env.example .env.local
npm run dev
```
打開 http://localhost:3000

### AI 設定（`.env.local`）
```
AI_PROVIDER=anthropic
AI_API_KEY=你的 Anthropic API Key
AI_MODEL=claude-opus-5-5
RATE_LIMIT_ANALYZE_PER_HOUR=20
RATE_LIMIT_LAYOUT_PER_HOUR=30
```
沒有填 `AI_API_KEY` 時網站會進入「示範模式」：辨識回傳假資料、自動配置改用內建規則，方便免費測試。

### 呼叫次數限制（防止 API 被濫用）
| 變數 | 預設 | 說明 |
|---|---|---|
| `RATE_LIMIT_ANALYZE_PER_HOUR` | 20 | 每個 IP 每小時最多呼叫幾次「AI 辨識牆面」 |
| `RATE_LIMIT_LAYOUT_PER_HOUR` | 30 | 每個 IP 每小時最多呼叫幾次「AI 自動配置／文字調整」 |

- 只有真的呼叫 AI 時才計次，示範模式不受限制。
- 超過限制會回傳 HTTP 429 與 `Retry-After`，網頁顯示「呼叫太頻繁，請 N 分鐘後再試」。
- 牆面照片請求超過 6 MB 會直接拒絕（HTTP 413），不會整包讀進記憶體。
- **注意**：目前的限制存在伺服器記憶體中，Vercel 同時開多個執行個體時彼此不共享，重新部署也會歸零，只能擋住一般濫用。之後接上 Supabase 登入後，可以改成依帳號限制並存進資料庫。

## 指令
| 指令 | 說明 |
|---|---|
| `npm run dev` | 開發模式 |
| `npm run build` | 正式建置 |
| `npm run lint` | 程式碼檢查 |
| `npm run fetch-models -- <KayKit gltf 資料夾>` | 下載 Poly Haven 模型並把 KayKit glTF 轉成 glb |
| `npm run catalog` | 讀取 `public/models/` 的模型包圍盒，重新產生 `data/catalog.json` |

### 加入 Kenney Furniture Kit
Kenney 網站不允許程式自動下載，請手動到 https://kenney.nl/assets/furniture-kit 下載，把 GLB 檔放進 `public/models/kenney/`，再執行 `npm run catalog`。

## 技術
Next.js 16、TypeScript、three.js（React Three Fiber）、zustand、Tailwind CSS、Anthropic SDK

## 素材授權
- KayKit Furniture Bits（CC0）
- Poly Haven（CC0）
- Kenney Furniture Kit（CC0，需手動加入）

網站內「素材來源與授權」頁面：`/licenses`
