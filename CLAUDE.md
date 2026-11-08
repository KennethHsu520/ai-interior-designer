# AI室內設計師 — 開發規格（給 Claude Code）

## 與使用者協作規則
- 一律用繁體中文回覆
- 程式碼中不要寫任何註解
- 每完成一個步驟都要自我驗證：執行 `npm run build` 與 `npm run lint`，確認沒有錯誤再回報
- 一次只做一個階段的一個步驟，做完讓使用者在瀏覽器確認後再往下
- 使用者：許睿川（靜宜大學資訊工程學系），以網站形式、免費為原則

## 最新方向（2026-11-08 更新，與下方內容衝突時以這裡為準）
- **零成本原則**：開發者不能有任何付費支出，不呼叫任何付費 AI API，也不使用需要開發者付費的雲端 GPU
- 需要 AI 的功能只能在使用者瀏覽器上執行（Transformers.js、ONNX Runtime WebGPU 等），或改用規則
- 牆面辨識改為使用者在照片上框選標記；瀏覽器端模型只作為「自動建議」
- 家具自動配置與文字調整改為前端規則引擎＋選項式需求
- 家具庫改放 Supabase 免費方案，並提供 `/admin` 管理頁面；必須能在資料庫連不上時退回內建家具
- 使用者可拍照建立自訂家具，資料存在使用者瀏覽器
- 下方提到 API Route、`lib/ai/provider.ts`、`AI_API_KEY` 的部分已作廢
- 詳細步驟見 `PLAN.md`

## 產品概念
讓想找室內設計師、想佈置房間的人，先在網站上自己試。流程分兩大階段：
1. **建立真實房間**：空白 3D 房間 → 輸入正確尺寸、調整格局 → 點每一面牆拍照 → AI 辨識該牆面的門、窗、開關、插座、電燈、冷氣、現有家具 → 使用者確認並修正位置
2. **家具擺放**：從大量家具素材中挑選 → 自己拖曳擺放，或勾選想要的家具讓 AI 自動配置 → 用文字跟 AI 說想法，AI 調整配置

**原則：先讓房間格局正確，再處理家具。**

## 技術選型
| 項目 | 技術 |
|---|---|
| 框架 | Next.js（App Router）+ TypeScript |
| 3D | three.js + @react-three/fiber + @react-three/drei |
| 狀態管理 | zustand（含 persist 存到 localStorage） |
| 樣式 | Tailwind CSS |
| AI 影像辨識 | 照片框選標記為主；OWLv2（Transformers.js 3.8，Web Worker、WASM）作為自動建議 |
| 家具配置 | 前端規則引擎（`lib/layoutEngine.ts`），需求選項存在 store |
| 照片生成 3D（實驗） | U²-Net 去背＋TripoSR（ONNX Runtime Web 1.30 WebGPU，從 CDN 載入），模型快取在 OPFS |
| 模型處理 | glTF-Transform＋meshoptimizer（管理頁上傳壓縮） |
| 部署 | Vercel 免費方案（Hobby 限非商業用途） |
| 資料庫 | Supabase 免費方案：家具庫與管理員帳號；之後再加使用者帳號與房間 |

## 座標與單位
- 單位一律為**公尺**，角度為弧度
- 地板在 y = 0，y 軸朝上，房間地板多邊形在 xz 平面
- 房間以地板頂點陣列（逆時針）表示，第 i 面牆 = 頂點 i 到頂點 i+1
- 牆上物件位置：`offset`＝距離牆起點的水平距離，`elevation`＝離地高度

## 資料模型（`types/room.ts`）
```ts
type Vec2 = { x: number; z: number }

type WallItemType =
  | 'door' | 'window' | 'switch' | 'outlet'
  | 'light' | 'air_conditioner' | 'furniture' | 'other'

type WallItem = {
  id: string
  type: WallItemType
  label: string
  offset: number
  elevation: number
  width: number
  height: number
  confidence?: number
  confirmed: boolean
}

type Wall = {
  id: string
  index: number
  photoUrl?: string
  items: WallItem[]
}

type Room = {
  id: string
  name: string
  floor: Vec2[]
  height: number
  walls: Wall[]
  ceilingItems: WallItem[]
}

type PlacedFurniture = {
  id: string
  catalogId: string
  position: { x: number; y: number; z: number }
  rotationY: number
  scale: number
}
```

## 階段一：建立真實房間

### 步驟 1-1　專案初始化
- `npx create-next-app@latest`（TypeScript、Tailwind、App Router、ESLint）
- 安裝 three、@react-three/fiber、@react-three/drei、zustand
- 首頁顯示全螢幕 3D 畫布，預設一間 4m × 3m、高 2.8m 的空白房間
- 可用滑鼠／手指旋轉、縮放視角（OrbitControls）

### 步驟 1-2　尺寸與格局編輯
- 側邊面板輸入長、寬、高（公尺，至小數點後兩位），3D 即時更新
- 支援矩形；之後加入「自訂格局」：2D 俯視圖拖曳頂點、在牆中間新增頂點，做出 L 型等格局
- 每面牆顯示長度標籤
- 驗證：尺寸需 > 0.5m、高度 2～5m、多邊形不可自我交叉

### 步驟 1-3　點牆拍照
- 3D 中滑鼠移到牆上要有高亮，點擊後選取該牆並開啟面板
- 面板提供「拍照／上傳」：`<input type="file" accept="image/*" capture="environment">`
- 提示使用者：盡量拍到整面牆，左右兩端牆角都要入鏡
- 照片先在前端壓縮（長邊 1600px、JPEG）再上傳
- 已拍照的牆面在 3D 上顯示打勾標記

### 步驟 1-4　AI 辨識
- API Route：`POST /api/analyze-wall`，輸入照片＋該牆的長度與房間高度
- 要求模型回傳**嚴格 JSON**，每個物件給：type、label、在照片中的正規化座標 `x0, x1, y0, y1`（0～1）、confidence
- 後端用 zod 驗證 JSON 格式，失敗就重試一次
- 換算成公尺：`offset = x0 × 牆長`、`width = (x1 − x0) × 牆長`、`elevation = (1 − y1) × 房高`、`height = (y1 − y0) × 房高`
- 天花板上的電燈、冷氣也要辨識，`type` 為 light／air_conditioner

### 步驟 1-5　確認與修正
- 辨識結果在 3D 牆面上用不同顏色的方塊／圖示顯示
- 使用者可以：拖曳修改位置、調整寬高、更改類型、刪除、手動新增
- 每個物件有「已確認」狀態；全部牆面確認完才能進入階段二
- 門與窗要在 3D 牆上真的挖洞或顯示框

### 步驟 1-6　儲存
- 用 zustand persist 存到 localStorage
- 提供匯出／匯入房間 JSON

## 階段二：家具擺放

### 步驟 2-1　家具素材庫
只用可商用、授權清楚的素材，先用以下三個 CC0 來源：
- Kenney Furniture Kit：https://kenney.nl/assets/furniture-kit
- KayKit Furniture Bits：https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0
- Poly Haven（寫實模型）：https://polyhaven.com/models

做法：
- 模型放在 `public/models/<來源>/`，統一轉成 `.glb`
- 建立 `data/catalog.json`：id、中文名稱、分類（床、沙發、桌、椅、櫃、燈、裝飾…）、風格標籤、來源、授權、檔案路徑、實際尺寸（公尺）、縮圖
- 寫一支腳本（`scripts/build-catalog.ts`）讀取模型的包圍盒，自動算出原始尺寸，再依真實家具尺寸換算縮放比例
- 網站內要有「素材來源與授權」頁面
- 之後擴充：Sketchfab Download API（使用者需登入 Sketchfab、必須顯示作者與授權）

### 步驟 2-2　手動擺放
- 家具清單可依分類、風格篩選與搜尋
- 拖進房間，在地板上移動、旋轉（每次 15°）、刪除
- 碰撞檢查：不能穿牆、不能與其他家具重疊、不能擋住門的開門範圍，違規時顯示紅色

### 步驟 2-3　AI 自動配置
- 使用者勾選多件家具 → `POST /api/auto-layout`
- 傳給 AI：房間多邊形、門窗開關插座冷氣位置、家具清單與尺寸、使用者的文字需求
- AI 回傳每件家具的 x、z、rotationY（嚴格 JSON）
- 前端再跑一次碰撞檢查，有問題的自動微調或標紅提示

### 步驟 2-4　文字調整
- 對話框：例如「床靠窗」「我要北歐風」「留走道給輪椅」
- AI 依目前配置與需求回傳新的配置，並用一句話說明改了什麼

## 資料夾結構
```
app/
  page.tsx                 主畫面（AppShell → Editor）
  admin/page.tsx           家具庫管理（Supabase Auth）
  licenses/page.tsx        素材與模型授權（從資料庫讀取）
  plan/page.tsx            設計圖輸出（PDF／DXF）
components/
  Editor.tsx
  admin/                   AdminApp、FurnitureList、NewFurniture、ItemFields
  scene/                   RoomScene、Wall、WallItemMesh、FurnitureMesh、HistoryControls、ViewControls…
  panels/                  RoomSizePanel、FloorPlanEditor、WallPhotoPanel、PhotoMarker、WallElevation、
                           FurnitureCatalog、CustomFurnitureDialog、SelectedFurniturePanel、ChatPanel（配置需求）
  plan/                    設計圖
lib/
  catalog.ts               即時家具目錄（內建＋資料庫＋自製）與 zustand store
  catalogLoader.ts         從 Supabase 載入、快取、連不上時退回內建
  catalogDb.ts、supabase.ts、adminApi.ts、modelProcess.ts、modelMeasure.ts
  customFurniture.ts       自製家具（IndexedDB）
  layoutEngine.ts          規則配置引擎與需求選項
  detect/                  OWLv2 自動建議（worker）
  recon/                   照片生成 3D（worker、marching cubes）
  geometry.ts、collision.ts、image.ts、io.ts、modelUrl.ts …
store/useRoomStore.ts      房間、家具、復原歷史、對話與需求（persist）
types/room.ts
data/catalog.json          內建家具（資料庫連不上時使用）
public/models/
scripts/                   build-catalog.ts、migrate-catalog.ts、fetch-models.ts
supabase/migrations/       資料表、RLS、Storage bucket
```

## 環境變數（`.env.local`，不要提交到 git）
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   只給本機 scripts/migrate-catalog.ts 用，絕不放前端
```

## 注意事項
- 單張照片無法得到精確尺寸，房間尺寸以使用者輸入為準，AI 只負責判斷「牆上有什麼、大概在哪」，最後一定要讓使用者確認
- 不呼叫任何付費 AI API；瀏覽器端模型下載前一定要說明大小並取得使用者同意
- 手機瀏覽器也要能操作（觸控旋轉、拍照）
