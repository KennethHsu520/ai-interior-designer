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
Next.js 16、TypeScript、three.js（React Three Fiber）、zustand、Tailwind CSS

## 素材授權
- KayKit Furniture Bits（CC0）
- Poly Haven（CC0）
- Kenney Furniture Kit（CC0，需手動加入）

網站內「素材來源與授權」頁面：`/licenses`
