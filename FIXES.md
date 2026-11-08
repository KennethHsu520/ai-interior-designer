# 修正任務清單（程式碼審查結果）

請依照 CLAUDE.md 的協作規則執行：
- 一律用繁體中文回覆，程式碼不要寫註解
- 一次只做一個步驟，做完執行 `npm run build` 與 `npm run lint` 確認沒有錯誤，再告訴我要在瀏覽器測什麼，等我確認後才做下一步
- 動手前先讀 `node_modules/next/dist/docs/` 裡相關的指南（AGENTS.md 有說明這版 Next.js 有破壞性變更）
- 每個步驟完成後，把該步驟標題前的 `[ ]` 改成 `[x]`

順序：A → B → C → D → E

---

## [x] 步驟 A　修正匯出／匯入 JSON 遺失資料

**問題**：`lib/io.ts` 的 `FileSchema` 沒有定義以下欄位，zod 預設會把未定義的欄位剝除，導致匯出後再匯入時資料遺失：
- `WallItem.swing`（門的開門方向）
- `Wall.lengthLocked`、`Wall.angleLocked`

**要做的事**：
1. 在 `lib/io.ts` 的 `ItemSchema` 加入 `swing`（optional，結構與 `types/room.ts` 的 `DoorSwing` 相同）
2. 在牆的 schema 加入 `lengthLocked`、`angleLocked`（optional boolean）
3. 檢查 `types/room.ts` 裡 `Room`、`Wall`、`WallItem`、`PlacedFurniture` 的每個欄位，確認 `FileSchema` 都有涵蓋，避免日後再漏
4. 如果可行，用 TypeScript 型別讓 schema 與型別不一致時編譯失敗（例如用 `satisfies` 或 `z.ZodType<...>` 比對）

**驗收**：設定一扇門為「鉸鏈在右、往外開、角度 110°」並鎖定某面牆長度 → 匯出 JSON → 重新開始 → 匯入 → 門的開向與牆的鎖定都和匯出前一樣。

---

## [x] 步驟 B　天花板物件重構＋修正重複辨識

**問題 1**：在 `components/panels/WallPhotoPanel.tsx` 裡，牆面物件用 `setWallItems` 取代，天花板物件卻用 `addCeilingItems` 累加，同一面牆按兩次「AI 辨識」，天花板的燈／冷氣會重複出現。

**問題 2**：天花板物件沿用 `WallItem` 型別，用 `offset` 存 x、`elevation` 存 z，欄位名稱與意義不符（見 `WallPhotoPanel.tsx` 與 `lib/layout.ts` 的 `describeRoomForAI`），容易寫錯。

**要做的事**：
1. 在 `types/room.ts` 把 `CeilingItem` 改成獨立型別：`id`、`type`、`label`、`x`、`z`、`width`、`depth`、`confidence?`、`confirmed`、`sourceWallId?`（記錄是從哪面牆的照片辨識出來的，用牆的 `id` 而不是 `index`，因為新增／刪除頂點後 index 會變）
2. 全專案搜尋 `ceilingItems`、`CeilingItem`、`addCeilingItems`、`updateCeilingItem` 並全部改用新欄位，至少包含：`store/useRoomStore.ts`、`components/panels/WallPhotoPanel.tsx`、`components/panels/RoomSizePanel.tsx`、`components/scene/RoomScene.tsx`、`lib/layout.ts`、`lib/io.ts`，以及 `components/plan/` 下有用到的檔案
3. 重新辨識某面牆時，先移除 `sourceWallId` 等於這面牆、且尚未確認的天花板物件，再加入新的；已確認的保留
4. 資料遷移（很重要，避免使用者舊資料壞掉）：
   - zustand persist 的 `version` 從 1 改成 2，寫 `migrate`，把舊的 `offset → x`、`elevation → z`、`height → depth`
   - `lib/io.ts` 匯入時也要能讀舊版（version 1）檔案並轉換；匯出改為 version 2
5. `lib/layout.ts` 的 `describeRoomForAI` 改用 `x`、`z`、`width`、`depth` 輸出天花板物件

**驗收**：
- 同一面牆連按兩次「AI 辨識」（示範模式即可），天花板物件數量不會增加
- 用舊版匯出的 JSON（version 1）匯入後，天花板物件位置正確
- 3D 中天花板物件位置和修改前一樣

---

## [x] 步驟 C　家具配置「復原」功能

**問題**：專案中沒有任何 undo 機制。使用者手動排好家具後，按一次「AI 自動配置」或在對話框送出一句話，配置就被覆蓋且無法找回。

**要做的事**：
1. 在 store 加入家具配置的歷史紀錄（只記 `furniture` 陣列，最多 30 步，不需要 persist）
2. 會改變家具的操作都要先存一份快照：新增、刪除、拖曳結束（不是拖曳中每一幀）、旋轉、縮放、改尺寸、改顏色、AI 自動配置、AI 文字調整
3. 提供「復原」與「重做」：
   - 擺放家具階段的畫面上有按鈕（手機也要按得到）
   - 鍵盤 Ctrl+Z／Ctrl+Shift+Z（Mac 用 Cmd），游標在文字輸入框時不要觸發
4. AI 配置完成後，在對話框或提示訊息中附一個「復原這次調整」的按鈕

**驗收**：手動擺好 3 件家具 → AI 自動配置 → 按復原 → 回到手動擺放的位置；再按重做 → 回到 AI 的配置。

---

## [x] 步驟 D　AI 對話要記得先前的需求

**問題**：`components/panels/ChatPanel.tsx` 每次只把當下這一句傳給 `/api/auto-layout`。使用者先說「床靠窗」再說「沙發面向電視」，第二次 AI 不知道第一個需求，可能把床移走。

**要做的事**：
1. `lib/requestLayout.ts` 與 `app/api/auto-layout/route.ts` 的請求加入 `history`：最近 6 則使用者需求與 AI 的說明（陣列，每則字數上限 500，zod 驗證）
2. 在 prompt 中加入「先前的需求（除非被新需求明確取代，否則仍需遵守）」區塊
3. 對話紀錄存進 store 並 persist（最多 30 則），重新整理頁面不會消失；匯出／匯入 JSON 不需包含對話
4. 對話框加一個「清除對話」按鈕
5. 「重新開始」時一併清除對話

**驗收**：先送「床靠窗」→ 再送「書桌放門旁邊」→ 床仍然靠窗（需要真的 AI_API_KEY 才能測，示範模式下確認 history 有正確送到 API 即可）。

---

## [x] 步驟 E　API 防濫用（部署前必做）

**問題**：`/api/analyze-wall` 與 `/api/auto-layout` 沒有任何呼叫限制。部署到 Vercel 並填入 API Key 後，任何人都能無限呼叫，費用由開發者負擔。

**要做的事**：
1. 新增 `lib/rateLimit.ts`：依 IP（從 `x-forwarded-for` 取第一個，沒有就用 `x-real-ip`）做固定時間窗的次數限制，存在記憶體 Map 中，並定期清除過期紀錄
2. 只有在真的呼叫 AI 時才計次，示範模式不限制
3. 限制值用環境變數設定，並給預設值：
   - `RATE_LIMIT_ANALYZE_PER_HOUR`（預設 20）
   - `RATE_LIMIT_LAYOUT_PER_HOUR`（預設 30）
4. 超過限制時回傳 HTTP 429，並附上繁體中文訊息與 `Retry-After` header；前端顯示「呼叫太頻繁，請 N 分鐘後再試」
5. 在 `analyze-wall` 先檢查請求本體大小，太大就直接拒絕，不要先 `request.json()` 整包讀進來
6. 更新 `.env.example` 與 `README.md` 說明這兩個變數
7. 在 README 註明：記憶體版限制在 Vercel 多個執行個體之間不共享，只能擋住一般濫用；之後接 Supabase 時，可以改成依登入帳號限制

**驗收**：把 `RATE_LIMIT_ANALYZE_PER_HOUR` 設成 2，填入 API Key，連續辨識 3 次，第 3 次出現「呼叫太頻繁」的提示。

---

## 不需要寫程式的項目（給使用者）
- Kenney Furniture Kit 需要手動到 https://kenney.nl/assets/furniture-kit 下載，把 GLB 檔放進 `public/models/kenney/`，再執行 `npm run catalog`
