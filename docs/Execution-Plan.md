# Home Flow 開發執行計畫（可分派 / 可中斷續做）

## Context

Repo 目前只有產品文件（PRD、Architecture、Data-Rules、Tasks）與一份範例 CSV，**尚無任何程式碼**。文件已把產品收斂到 M1–M5 里程碑與驗收清單，可開工。

缺的不是「要做什麼」，而是**執行層**：把里程碑切成可獨立分派給後續 agent 的小任務，每個任務有明確輸入／產出／驗收門檻，且進度可隨時中斷、由別人接手續做。

狀態追蹤機制採 repo 內 `docs/STATUS.md` 勾選清單（純文字、git 可追、任何 agent 接手即見進度）。

技術棧（文件已定，不重議）：SvelteKit + Cloudflare Pages/Functions + D1 + Google OAuth + Gemini 2.5 Flash-Lite（AI 為可關閉輔助）。

---

## 執行前先處理的兩個既存落差

1. **環境變數名稱不一致**：`.env` 內是 `GEMINI_API_KEY`，文件（Architecture §6、README）要求 `GOOGLE_AI_API_KEY`。M1 設定環境變數時統一為文件版 `GOOGLE_AI_API_KEY`，並更新 `.env` 範例。
2. **CSV 解析現實**：`docs/費用.csv` 首列為雜訊（全空 + 落單空白）、第 2 列才是 M/D 日期表頭、分類為列、**末欄是該分類合計**（非某日金額，解析時須排除）、千分位以引號包覆如 `"5,881"`、空白＝無消費。M2 parser 須吃下這些，並用 `parsed_rows`／合計欄做交叉驗證（Data-Rules §7 的 warning）。

---

## 分派模型（每個任務單位的契約）

每個任務在 `docs/STATUS.md` 是一行勾選項，格式：

```
- [ ] T<里程碑>.<序號> <標題>  | 依賴: T.. | 狀態: todo|wip|done|blocked
      驗收: <一句可機械驗證的門檻>
```

分派一個任務給 agent 時，agent 只需讀：本計畫對應段落 + 該任務的依賴產出 + 相關 docs/prd 章節。完成條件 = 驗收門檻通過 → 把該行改 `done` 並 commit。中斷時狀態停在 `wip`，接手者從同一行續做。

**鐵則**：跨任務不得共享未 commit 狀態；每個 `done` 任務都要留下可重跑的驗證（migration 可重現、test 可跑、或一條 curl/指令）。

---

## 里程碑與任務拆解

### M0 — 專案地基（新增，先於 M1）
- **T0.1** 初始化 SvelteKit（含 TypeScript、ESLint、Prettier）→ 驗收：`npm run dev` 起得來，預設頁 200。
- **T0.2** 接 `@sveltejs/adapter-cloudflare`、加 `wrangler.toml`、D1 binding 佔位 → 驗收：`npm run build` 過，產出 Pages 相容輸出。
- **T0.3** 建 `docs/STATUS.md`（本計畫全任務清單）+ `.dev.vars` 範例（環境變數見下）→ 驗收：STATUS.md 含 M0–M5 全任務、git committed。

### M1 — 可部署 / 可登入 / 可連 DB 空殼
對應 docs/prd/Tasks.md M1。
- **T1.1** D1 migration 初版 schema（households, users, expenses, imports, category_aliases, category_overrides, fixed_expense_overrides, ai_suggestions；保留 household_id 維度）→ 驗收：`wrangler d1 migrations apply` 本機可重現、可重跑。
- **T1.2** admin bootstrap seed + repo 設定檔式 allowlist 載入（`config/allowlist.ts`，結構見 Architecture §6.1）→ 驗收：seed 後 D1 有第一位 admin；非 allowlist email 標記不可登入。
- **T1.3** Google OAuth 流程（auth callback + session/me），HttpOnly secure cookie session，7 天 → 驗收：admin/viewer 各自登入後 `/session/me` 回對應角色。
- **T1.4** 角色守衛（所有修改型 route 驗 admin）→ 驗收：viewer 打修改型 API 得 403。
- **T1.5** Cloudflare Pages 部署接線（GitHub push 自動部署）+ OAuth/session 穩定性 PoC（Architecture §4.4 三條 PoC 標準）→ 驗收：push 後自動上線；重整／關開瀏覽器 7 天內登入不失。secret 不進前端 bundle。

> **免費額度閘**：T1.5 同時驗證 Pages/D1/OAuth 全走免費方案。若 session PoC 不過，降級為 signed token session（Architecture §4.4 備援）。

### M2 — 匯入與標準化
對應 Tasks.md M2 + Data-Rules §3/§6/§7。
- **T2.1** CSV 上傳頁 + 大小限制（預設 10MB，前端先擋）→ 驗收：>10MB 被前端拒絕。
- **T2.2** CSV parser：吃橫向日期結構、跳首列雜訊、辨識日期表頭、排除末欄合計、解析千分位、空白＝跳過 → 驗收：能解出 `docs/費用.csv` 全部有效儲存格；用末欄合計交叉驗證。
- **T2.3** 欄位語意辨識（容忍欄序變動、日期範圍長短、分類增減）→ 驗收：相近格式樣本（人工改造一份）仍可解析。
- **T2.4** 標準化為儲存格級 expense 模型（Data-Rules §3.1，同日同分類允許多列、不強制加總）→ 驗收：產出符合 schema 的列。
- **T2.5** preview→commit 兩段式 + 增量合併（重複略過 / 金額異動為更新候選預設採新值 / 可保留舊值或略過，Data-Rules §6）→ 驗收：同檔重匯 inserted=0、duplicate=全部；改一格金額重匯出現 1 筆更新候選。
- **T2.6** import job 與匯入摘要（六欄：parsed/inserted/duplicate/updated/skipped/warning）+ 匯入歷程儲存 → 驗收：commit 後歷程列出時間、匯入者、筆數、狀態。
- **T2.7** 錯誤分級（blocking / warning / info，Data-Rules §7）→ 驗收：壞日期／壞金額／空分類觸發 blocking 並清楚提示。

### M3 — 分類與校正
對應 Tasks.md M3 + Data-Rules §4/§5/§9。
- **T3.1** 標準分類表 + 預置基本分類集合 → 驗收：seed 後存在基本分類。
- **T3.2** 分類別名映射表（raw→normalized，含 source: manual/ai_auto）+ 待確認清單 → 驗收：未匹配 raw_category 進待確認。
- **T3.3** 分類決策優先級（override > manual alias > ai_auto alias > fallback，Data-Rules §4.4）→ 驗收：四層各有測試案例命中對應層。
- **T3.4** 分類人工修正 + 固定支出人工覆寫（`固-` 開頭與帳單型分類預設 true；人工優先）→ 驗收：覆寫後報表即時反映。
- **T3.5** 人工確認規則回寫、套用到後續匯入 → 驗收：確認後重匯，原待確認項自動套用。

### M4 — 報表與明細
對應 Tasks.md M4 + Data-Rules §8。
- **T4.1** 月報首頁：當月總支出 + 預設最近月份 → 驗收：數字與 D1 聚合一致。
- **T4.2** 分類排行 + 分類占比圖（圖表套件選型在此定，免費／開源優先）→ 驗收：占比加總 100%。
- **T4.3** 與上月比較 + 月趨勢圖 → 驗收：比較差異正確。
- **T4.4** 明細查詢與過濾（月份／日期區間／分類／固定與否，Data-Rules §8.1）→ 驗收：四種過濾各自正確。
- **T4.5** 圖表點擊聯動篩選（占比圖→篩明細與分析區；月圖→切月；再點清除，§8.2）→ 驗收：點分類後明細同步、再點還原。
- **T4.6** RWD（桌機 + 手機）→ 驗收：窄寬視窗皆可用。

### M5 — AI 輔助（可關閉，最後做、可延後）
對應 Tasks.md M5 + Data-Rules §9。**不阻擋 M1–M4 上線**。
- **T5.1** server route 代理 Gemini 呼叫，key 只在 server env（`GOOGLE_AI_API_KEY`）→ 驗收：前端 bundle 無 key；前端無直連第三方。
- **T5.2** feature flag（`AI_FEATURE_ENABLED`）全關時主流程不受影響 → 驗收：關閉後匯入／校正／報表照常。
- **T5.3** 限流 + 錯誤處理 + fallback + 連續失敗自動停用 → 驗收：模擬失敗時降級不崩。
- **T5.4** 每次匯入後對未匹配分類產生建議；高信心（門檻 `AI_AUTO_ACCEPT_THRESHOLD` 預設 0.85，可設）自動寫 category_aliases；低信心進待確認 → 驗收：高信心自動採納、低信心需人工確認後才寫正式資料。
- **T5.5** 額度監控提醒（80% 警告 / 90% 停用自動建議，Architecture §9）→ 驗收：模擬額度觸發對應行為。

---

## 依賴順序（關鍵路徑）

```
M0 → M1 → M2 → M3 → M4
                 ↘ M5（接 M2/M3 產出，可延後、可並行於 M4）
```

M4 可在 M3 完成後開工；M5 只要 M2（匯入）+ M3（別名表）就緒即可起，且因「可關閉」不在主關鍵路徑。

---

## 環境變數（M0/M1 落地，統一文件版命名）

```
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET   # OAuth
SESSION_SECRET / SESSION_MAX_AGE_DAYS     # session（預設 7 天）
D1_DATABASE_BINDING                        # D1
GOOGLE_AI_API_KEY                          # ★ 統一名稱，取代 .env 現有 GEMINI_API_KEY
AI_FEATURE_ENABLED / AI_AUTO_ACCEPT_THRESHOLD  # AI（預設 0.85）
```

---

## 要建立 / 修改的關鍵檔案

| 路徑 | 用途 | 任務 |
|---|---|---|
| `docs/STATUS.md` | 全任務勾選清單（狀態源） | T0.3 |
| `package.json` / `svelte.config.js` / `wrangler.toml` | SvelteKit + Cloudflare adapter + D1 binding | T0.1–T0.2 |
| `migrations/*.sql` | D1 schema（8 表） | T1.1 |
| `config/allowlist.ts` | email + 角色（private repo） | T1.2 |
| `src/lib/server/auth/*` | OAuth callback、session、角色守衛 | T1.3–T1.4 |
| `src/lib/server/csv/*` | parser、欄位辨識、標準化 | T2.2–T2.4 |
| `src/lib/server/import/*` | preview→commit、增量合併、摘要 | T2.5–T2.6 |
| `src/routes/(app)/...` | 報表／明細／匯入／校正／歷程頁 | M4 |
| `src/lib/server/ai/*` | Gemini proxy、flag、fallback | M5 |
| `.dev.vars` / `.env`（範例） | 環境變數，改名 `GOOGLE_AI_API_KEY` | T0.3 |

> 既有 docs/prd/* 為唯讀依據，**不改動**（除非發現規格矛盾，先回報再動）。

---

## 驗證（整體 end-to-end）

對齊 Tasks.md §5 驗收清單，最終跑一輪：
1. admin/viewer Google 登入，角色權限正確（viewer 修改型 API 得 403）。
2. `wrangler d1 migrations apply` 全新重現 schema。
3. push → Cloudflare Pages 自動部署成功、前端 bundle 無 secret。
4. 匯入 `docs/費用.csv`：preview→commit，摘要六欄正確；同檔重匯 0 新增。
5. 改造一份相近格式 CSV 仍可匯入。
6. 月報顯示總支出／排行／占比／月比較／月趨勢，數字與 D1 聚合一致。
7. 明細四種過濾 + 圖表點擊聯動 + 再點清除。
8. AI 關閉時主流程照常；開啟時低信心建議須人工確認才寫入。

每個里程碑收尾以「該里程碑驗收判定」當 gate，全綠才把 STATUS.md 對應段落標 done。
