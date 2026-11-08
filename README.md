# AI室內設計師

上傳家裡每一面牆的照片，建立正確的 3D 房間格局，再從大量家具中挑選，自己擺放或一鍵自動配置。網站完全免費，不呼叫任何付費 AI 服務。

## 功能
- 3D 空白房間，輸入真實尺寸（長、寬、高），或在 2D 俯視圖拖曳頂點做出 L 型等格局
- 點擊牆面拍照，在照片上標出牆角，再框選門、窗、開關、插座、電燈、冷氣與現有家具（支援手機觸控與放大）
- 在立面圖或 3D 中拖曳、縮放、改類型、刪除、新增，逐面牆確認
- 家具素材庫 85 件（CC0 授權），可依分類、風格篩選與搜尋
- 手動拖曳擺放（碰撞檢查：穿牆、重疊、擋門會變紅）／用內建規則自動配置，可復原與重做
- 自動存到瀏覽器，可匯出／匯入房間 JSON（含照片）

## 開始使用
```bash
npm install
npm run dev
```
打開 http://localhost:3000

不需要任何 API Key：所有功能都在瀏覽器裡執行，照片與房間資料只存在使用者自己的瀏覽器。

## 家具資料庫（Supabase 免費方案，選用）
沒有設定時網站會直接使用內建的 `data/catalog.json` 與程式生成家具。

1. 到 [supabase.com](https://supabase.com) 建立免費專案。
2. 在專案的 **SQL Editor** 依序貼上並執行 `supabase/migrations/` 裡的檔案（依檔名排序）：建立 `furniture`、`admins` 資料表、Row Level Security 與 `models` Storage bucket。
3. 把 **Project Settings → API** 的網址與 publishable（anon）金鑰填進 `.env.local`（可以從 `.env.example` 複製）：
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxx
   ```
4. 匯入內建家具：在 `.env.local` 暫時加上 `SUPABASE_SERVICE_ROLE_KEY`（只給本機腳本用，絕對不要提交或放進前端）後執行 `npm run migrate-catalog`；或執行 `npx tsx scripts/migrate-catalog.ts --sql` 把輸出的 SQL 貼到 SQL Editor。
5. 管理員：打開 `/admin` 註冊帳號並完成信箱確認，登入後頁面會顯示一行 SQL，到 SQL Editor 執行即可成為管理員。
6. 部署到 Vercel 時，在 **Project Settings → Environment Variables** 加上第 3 步的兩個變數（不要加 service role key）；並在 Supabase **Authentication → URL Configuration** 把網站網址加入 Site URL 與 Redirect URLs，確認信的連結才會回到正確的網站。

### 免費方案注意事項
- **閒置一週會暫停**：資料庫連不上時，網站自動改用內建家具並在家具庫上方顯示提示，不影響使用。到 Supabase 後台按 Restore 即可恢復。
- **每月 5 GB 流量**：內建模型放在網站主機的 `public/models/`，不佔 Supabase 流量；從 `/admin` 新增的模型會先縮小貼圖並用 meshopt 壓縮，檔名使用內容指紋、快取一年。
- 家具清單會快取在瀏覽器，下次開啟先顯示快取再背景更新。

## 指令
| 指令 | 說明 |
|---|---|
| `npm run dev` | 開發模式 |
| `npm run build` | 正式建置 |
| `npm run lint` | 程式碼檢查 |
| `npm run fetch-models -- <KayKit gltf 資料夾>` | 下載 Poly Haven 模型並把 KayKit glTF 轉成 glb |
| `npm run catalog` | 讀取 `public/models/` 的模型包圍盒，重新產生 `data/catalog.json` |
| `npm run migrate-catalog` | 把 `data/catalog.json` 寫進 Supabase（需要 service role key；加 `-- --sql` 只輸出 SQL） |

### 加入 Kenney Furniture Kit
Kenney 網站不允許程式自動下載，請手動到 https://kenney.nl/assets/furniture-kit 下載，把 GLB 檔放進 `public/models/kenney/`，再執行 `npm run catalog`。

## 技術
Next.js 16、TypeScript、three.js（React Three Fiber）、zustand、Tailwind CSS、Supabase（家具庫與管理員登入）

## 素材授權
- KayKit Furniture Bits（CC0）
- Poly Haven（CC0）
- Kenney Furniture Kit（CC0，需手動加入）

網站內「素材來源與授權」頁面：`/licenses`
