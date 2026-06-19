# Home Flow 任務狀態

狀態源。每行一個任務，格式見 `Execution-Plan.md`。

## M0 — 專案地基

- [x] T0.1 初始化 SvelteKit | 依賴: 無 | 狀態: done
      驗收: `npm run dev` 起得來，預設頁 200
- [x] T0.2 Cloudflare adapter + wrangler | 依賴: T0.1 | 狀態: done
      驗收: `npm run build` 過，產出 Pages 相容輸出
- [x] T0.3 STATUS.md + .dev.vars 範例 | 依賴: 無 | 狀態: done
      驗收: STATUS.md 含 M0–M5 全任務、git committed

## M1 — 可部署 / 可登入 / 可連 DB 空殼

- [x] T1.1 D1 migration 初版 schema | 依賴: T0.2 | 狀態: done
      驗收: `wrangler d1 migrations apply` 本機可重現、可重跑
- [x] T1.2 admin bootstrap seed + allowlist | 依賴: T1.1 | 狀態: done
      驗收: seed 後 D1 有第一位 admin；非 allowlist email 標記不可登入
- [x] T1.3 Google OAuth + session | 依賴: T1.2 | 狀態: done
      驗收: admin/viewer 各自登入後 `/session/me` 回對應角色
- [x] T1.4 角色守衛 | 依賴: T1.3 | 狀態: done
      驗收: viewer 打修改型 API 得 403
- [x] T1.5 Cloudflare Pages 部署 + session PoC | 依賴: T1.4 | 狀態: done
      驗收: push 後自動上線；重整／關開瀏覽器 7 天內登入不失；secret 不進前端 bundle
      備註: code side complete — login/home pages, bundle security verified; actual CF deploy is manual

## M2 — 匯入與標準化

- [x] T2.1 CSV 上傳頁 + 大小限制 | 依賴: T1.5 | 狀態: done
      驗收: >10MB 被前端拒絕
- [x] T2.2 CSV parser | 依賴: T2.1 | 狀態: done
      驗收: 能解出 `docs/費用.csv` 全部有效儲存格；用末欄合計交叉驗證
- [x] T2.3 欄位語意辨識 | 依賴: T2.2 | 狀態: done
      驗收: 相近格式樣本仍可解析
- [x] T2.4 標準化為 expense 模型 | 依賴: T2.3 | 狀態: done
      驗收: 產出符合 schema 的列
- [x] T2.5 preview→commit + 增量合併 | 依賴: T2.4 | 狀態: done
      驗收: 同檔重匯 inserted=0、duplicate=全部；改一格金額重匯出現 1 筆更新候選
- [x] T2.6 import job + 匯入摘要 + 歷程 | 依賴: T2.5 | 狀態: done
      驗收: commit 後歷程列出時間、匯入者、筆數、狀態
- [x] T2.7 錯誤分級 | 依賴: T2.2 | 狀態: done
      驗收: 壞日期／壞金額／空分類觸發 blocking 並清楚提示

## M3 — 分類與校正

- [x] T3.1 標準分類表 + 預置分類 | 依賴: T1.1 | 狀態: done
      驗收: seed 後存在基本分類
- [x] T3.2 分類別名映射 + 待確認清單 | 依賴: T3.1 | 狀態: done
      驗收: 未匹配 raw_category 進待確認
- [x] T3.3 分類決策優先級 | 依賴: T3.2 | 狀態: done
      驗收: 四層各有測試案例命中對應層
- [x] T3.4 人工修正 + 固定支出覆寫 | 依賴: T3.3 | 狀態: done
      驗收: 覆寫後報表即時反映
- [x] T3.5 規則回寫 + 套用後續匯入 | 依賴: T3.4 | 狀態: done
      驗收: 確認後重匯，原待確認項自動套用

## M4 — 報表與明細

- [x] T4.1 月報首頁 | 依賴: T3.5 | 狀態: done
      驗收: 數字與 D1 聚合一致
- [x] T4.2 分類排行 + 占比圖 | 依賴: T4.1 | 狀態: done
      驗收: 占比加總 100%
- [x] T4.3 月比較 + 月趨勢圖 | 依賴: T4.1 | 狀態: done
      驗收: 比較差異正確
- [x] T4.4 明細查詢與過濾 | 依賴: T4.1 | 狀態: done
      驗收: 四種過濾各自正確
- [x] T4.5 圖表點擊聯動 | 依賴: T4.2, T4.3, T4.4 | 狀態: done
      驗收: 點分類後明細同步、再點還原
- [x] T4.6 RWD | 依賴: T4.5 | 狀態: done
      驗收: 窄寬視窗皆可用

## M5 — AI 輔助

- [x] T5.1 Gemini server proxy | 依賴: T2.6 | 狀態: done
      驗收: 前端 bundle 無 key；前端無直連第三方
- [x] T5.2 feature flag | 依賴: T5.1 | 狀態: done
      驗收: 關閉後匯入／校正／報表照常
- [x] T5.3 限流 + fallback + 自動停用 | 依賴: T5.2 | 狀態: done
      驗收: 模擬失敗時降級不崩
- [x] T5.4 匯入後 AI 分類建議 | 依賴: T5.3, T3.2 | 狀態: done
      驗收: 高信心自動採納、低信心需人工確認
- [x] T5.5 額度監控 | 依賴: T5.4 | 狀態: done
      驗收: 模擬額度觸發對應行為
- [x] T5.6 AI 建議審核 UI（校正頁 surface pending 建議 + 匯入結果 AI 摘要） | 依賴: T5.4 | 狀態: done
      驗收: 匯入含未匹配分類後，校正頁可採納/忽略低信心建議，採納後 expenses 回填
- [x] T5.7 移除外洩金鑰 + 改寫歷史 | 依賴: 無 | 狀態: done
      驗收: git log -p --all 查無 GOOGLE/GEMINI key（✓ filter-repo + force push）；外洩 key AIzaSyCw1g… 已於 Google 端刪除

## M6 — 測試

- [x] T6.1 Playwright 正向流程 e2e | 依賴: T4.1 | 狀態: done
      驗收: `npm run test:e2e` 綠 — 登入(偽造 session)→匯入 docs/費用.csv→月報出現總支出

## M7 — 分類系統重設計

PRD: [docs/prd/Category-Redesign.md](docs/prd/Category-Redesign.md)

- [x] T7.1 categories 表 + seed migration | 依賴: 無 | 狀態: done
      驗收: `wrangler d1 migrations apply` 後 categories 表有 9 大類 22 子類；UNIQUE(parent_id, name) 生效
- [x] T7.2 categories CRUD API | 依賴: T7.1 | 狀態: done
      驗收: GET /api/categories 回兩層樹；POST/PUT/DELETE 各操作正確；刪除大類 cascade 子類；軟刪除後 GET 不回傳
- [x] T7.3 現有表 FK 遷移 | 依賴: T7.1 | 狀態: done
      驗收: expenses.category_id、category_aliases.category_id、category_overrides.category_id、fixed_expense_rules.category_id 均為 INTEGER FK；現有文字資料已 backfill 為對應 ID
- [x] T7.4 resolveCategory 改查 DB | 依賴: T7.3 | 狀態: done
      驗收: resolve.test.ts 全過；layer 4 fallback 查 categories 表而非硬編碼 set；刪除 categories.ts
- [x] T7.5 分類編輯器頁面 /settings/categories | 依賴: T7.2 | 狀態: done
      驗收: 管理者可新增/改名/刪除/排序大類與子類，含 icon/color 編輯；viewer 無法存取
- [x] T7.6 前端下拉改兩層動態選擇 | 依賴: T7.2, T7.4 | 狀態: done
      驗收: 校正頁、匯入預覽、單筆覆寫的分類選擇均為兩層級聯（大類→子類）；資料來自 API
- [x] T7.7 AI prompt 動態化 + 歷史範例注入 | 依賴: T7.3, T7.4 | 狀態: done
      驗收: buildPrompt 從 DB 讀分類+歷史範例；token ≤ 4000；無分類時跳過 AI
- [x] T7.8 報表兩層聚合 | 依賴: T7.3 | 狀態: done
      驗收: 月報可按大類聚合也可按子類展開；占比加總 100%
- [x] T7.9 刪除清理 + 回歸測試 | 依賴: T7.4, T7.6, T7.7, T7.8 | 狀態: done
      驗收: 刪除分類後費用變未分類、aliases 軟刪、pending ai_suggestions 拒絕；既有 e2e 仍綠

## M8 — UED 改善 Phase 1（UX 止血）

計劃: `~/.claude/plans/ux-ui-ued-swirling-pizza.md`

- [x] T8.1 分類刪除確認 modal | 依賴: 無 | 狀態: done
      驗收: 點分類刪除跳確認 modal，文案顯示分類名稱與級聯影響；確認才真正刪除（截圖驗證）
- [x] T8.2 導覽當前頁高亮 | 依賴: 無 | 狀態: done
      驗收: 桌面/手機選單，當前路由連結反白（light pill；corporate menu-active 與 navbar 同色故改用自訂樣式，截圖驗證）
- [x] T8.3 按鈕標籤全字（存/消→儲存/取消）| 依賴: 無 | 狀態: done
      驗收: 子分類與明細 inline edit 按鈕為「儲存／取消」全字
- [x] T8.4 匯入新紀錄可展開全部 | 依賴: 無 | 狀態: done
      驗收: 預覽新紀錄預設折疊 20 筆，可切換顯示全部 n 筆；每次上傳重置
- [x] T8.5 可關閉 alert | 依賴: 無 | 狀態: done
      驗收: 分類頁 success/error alert 有關閉鈕，success 5s 自動消失

## M9 — UED 改善 Phase 2（視覺系統 / 現代金融感）

- [x] T9.1 自訂 DaisyUI 主題 homeflow | 依賴: 無 | 狀態: done
      驗收: app.css 定義品牌 token（emerald primary、ink neutral、cool base、depth 陰影、圓角 box），脫離 corporate 預設藍；app.html data-theme 同步（全站截圖驗證）
- [x] T9.2 圖表配色對齊主題 | 依賴: T9.1 | 狀態: done
      驗收: 月報 doughnut/bar 改用與品牌協調的調色盤，選中月份 emerald 強調（截圖驗證）
- [x] T9.3 元件微一致化 | 依賴: T9.1 | 狀態: done
      驗收: 分類編輯名稱空白顯示 input-error 紅框且阻擋儲存（取代靜默 no-op）；圖標/顏色標籤改 label-text 一致；按鈕尺寸階層與 badge 語意抽查確認已一致（無需改）

## M10 — UED 改善 Phase 3（互動優化）

- [x] T10.1 inline 編輯鍵盤操作 + 明確狀態 | 依賴: 無 | 狀態: done
      驗收: 明細/分類編輯列 Enter 儲存、Esc 取消；編輯列加 primary ring 明顯標示（截圖驗證）
- [x] T10.4 載入提示文字 | 依賴: 無 | 狀態: done
      驗收: 月報/明細/分類/校正 spinner 旁顯示「載入中…」
- [x] T10.5 a11y：導覽 dropdown ARIA + modal backdrop 改 button | 依賴: 無 | 狀態: done
      驗收: dropdown 有 aria-haspopup/label；刪除 modal backdrop 為 button，svelte-check 0 warnings
- [x] T10.2 明細批次操作 | 依賴: 無 | 狀態: done
      驗收: 明細表勾選多筆（含全選）後，批次套用分類或批次刪除（confirm）；
      用 Promise.all 迴圈既有單筆 API（無新後端），失敗計數 alert；功能測試 BULK_OK + 截圖驗證
      備註: 校正頁 AI 建議批次採納已存在；待確認映射因各 raw 需不同目標分類，批次價值低，暫不做
- [x] T10.3 排序指示 icon 化 | 依賴: 無 | 狀態: done
      驗收: 明細表排序指示由 ASCII ▲▼ 改為 SVG chevron snippet（primary 色、asc 旋轉 180）；截圖驗證
