# Home Flow 技術架構

## 1. 目標架構

第一版採單一 GitHub repo，push 後自動部署到 Cloudflare Pages。

第一版架構需以免費資源優先為前提，避免產生固定月費。

若接入 LLM 且 API key 以環境變數管理，部署模型不可定義為純靜態網站，而應定義為：靜態前端搭配 Cloudflare Serverless 執行層。

建議架構如下：

- 前端與 BFF：SvelteKit
- 部署：Cloudflare Pages
- Server Runtime：Cloudflare Pages Functions
- 資料庫：Cloudflare D1
- 身份驗證：Google OAuth
- AI Provider：Google Gemini API，第一版預設使用 Gemini 2.5 Flash-Lite 免費模型，由 server route 代理呼叫
- 角色設定：repo 內設定檔，隨部署版本發布

補充限制：

- 角色設定檔含家人 email，僅適用於 private repo

## 2. 為何這樣選

### 2.1 SvelteKit

- 符合既有技術偏好
- 可同時處理前端頁面與 API route
- 適合部署到 Cloudflare Pages

### 2.2 Cloudflare Pages

- 符合預期部署流程：GitHub push 後自動部署
- 靜態頁與函式可同平台管理
- 對第一版小型家庭應用已足夠
- 有免費方案，符合第一版成本原則

### 2.3 D1

- 與 Cloudflare 生態整合直接
- 對 1 到 3 位家庭使用者與支出資料規模足夠
- 易於保存結構化支出、使用者、映射規則與校正結果
- 可先以免費額度驗證第一版需求

### 2.4 Google OAuth

- 不需自建帳密系統
- 可降低第一版開發成本與維護成本
- 在小規模家用情境下足以滿足需求

### 2.5 Google Gemini API

- 若使用 API key，必須放在 server 端環境變數
- 前端不可直接持有 secret key
- 透過 Pages Functions 代理可同時保護憑證與控制用量
- 第一版預設模型為 Gemini 2.5 Flash-Lite，前提是可持續使用免費額度
- 可將 AI 能力設計為可選功能，避免模型不可用時影響主流程
- 第一版只用於分類別名建議，不處理自由問答型功能
- 高信心自動採納預設門檻為 0.85，需可配置

## 3. 建議系統分層

### 3.1 前端頁面

- 登入頁
- 月報首頁
- 分類分析頁
- 支出明細頁
- 匯入頁
- 校正頁
- 匯入歷程頁

圖表交互最低要求：

- 點擊分類占比圖的分類後，同步篩選明細列表與分類分析區塊
- 點擊月比較或月趨勢圖後，同步切換對應月份資料

### 3.2 Server API

- auth callback
- session/me
- imports/upload
- imports/preview
- imports/commit
- reports/monthly
- reports/categories
- reports/trend
- imports/history
- expenses/search
- corrections/update
- ai/category-suggest

### 3.3 資料層

- users
- roles
- households
- import_jobs
- expenses
- category_aliases
- category_overrides
- fixed_expense_rules
- fixed_expense_overrides

補充說明：

- 第一版雖然只有單一家戶情境，資料模型仍建議保留 household 維度
- 這可避免未來在權限、資料隔離與部署擴充時需要重做主鍵策略

## 4. 驗證與授權建議

### 4.1 第一版建議做法

- 使用 Google OAuth 完成登入
- 以 repo 設定檔中的 email allowlist 控制可登入人員
- 使用 roles 欄位標示 admin 或 viewer
- 第一位 admin 由 migration 或 seed 手動建立，不依賴首次登入自動升權

### 4.3 Admin Bootstrap SOP

1. 於 repo 設定檔中先填入第一位 admin 的 Google email
2. 部署前執行 D1 migration 與 seed，建立 households 與初始 admin 使用者資料
3. 部署後由該 admin 完成首次 Google 登入
4. 若 seed 失敗，不允許以首次登入自動升權補救，需修正 seed 後重新部署

Seed 失敗恢復流程：

1. 檢查 users、roles、households 等必要資料表是否已建立
2. 檢查 repo 設定檔中的 admin email 是否與預期 Google 帳號一致
3. 重新執行 seed 並驗證 D1 中是否已有 admin 角色資料
4. 確認無誤後重新部署並重新登入

### 4.4 Session 管理

- 第一版採 HttpOnly secure cookie session
- session 預設有效期為 7 天
- 需在 M1 先完成 Cloudflare Pages 上的 session 穩定性 PoC
- 若 PoC 顯示 session 無法穩定維持，改採 signed token session 作為備援方案

PoC 驗證標準：

- 重新整理頁面後 session 不遺失
- 關閉瀏覽器再開啟後，7 天內仍可維持登入
- 管理頁與 API 請求可穩定識別同一使用者

### 4.2 權限規則

- admin 可匯入、校正、查看所有頁面
- viewer 僅可查看報表與明細
- 所有修改型 API 需驗證 admin 權限

## 5. 部署流程

1. GitHub repo push 到主分支
2. Cloudflare Pages 自動建置 SvelteKit
3. 綁定 D1 database 與環境變數
4. 上線後以 Pages domain 提供存取

## 5.1 成本控制原則

- 預設只使用 Cloudflare 免費方案可涵蓋的能力
- 圖表、UI、CSV 解析等優先選擇免費且成熟的開源套件
- 若 Cloudflare 免費額度已不足，再評估降級功能或切換方案，而不是直接增加付費服務
- 若使用 Google AI，需先確認可接受其免費額度或額外 token 成本
- AI 功能應可獨立關閉，避免單一外部成本破壞整體免費優先原則

## 5.2 大檔與長任務限制

- 第一版需定義 CSV 上傳大小限制，預設建議為 10MB
- 超過限制時，前端直接拒絕上傳並提示使用者
- 匯入解析需避免一次性無限制載入造成 server timeout
- 若解析耗時過長，系統需保留升級為非同步 job 的設計空間

## 6. 必要環境變數

- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- SESSION_SECRET
- D1_DATABASE_BINDING
- GOOGLE_AI_API_KEY
- AI_FEATURE_ENABLED
- SESSION_MAX_AGE_DAYS
- AI_AUTO_ACCEPT_THRESHOLD

## 6.1 設定檔規格

- allowlist 與角色建議存於 repo 內的 private 設定檔
- 建議格式為 JSON 或 TypeScript config
- 建議最小結構如下：

```json
{
  "users": [
    { "email": "admin@example.com", "role": "admin" },
    { "email": "viewer@example.com", "role": "viewer" }
  ]
}
```

- 修改設定檔後需重新部署才會生效

## 7. 實作決策

### 7.1 建議採納

- 單 repo
- 單一 SvelteKit app
- server route 處理登入、匯入、查詢 API
- 使用輕量圖表套件
- 只選用免費或開源依賴作為第一優先
- AI 功能一律走 server route，避免 secret 外洩
- AI 功能採 feature flag 或可停用設計
- 匯入採 preview -> commit 兩段式流程，避免直接寫入造成資料污染
- allowlist 以 repo 設定檔維護，避免第一版多做後台管理
- session 預設維持登入約 7 天
- 圖表需支援點擊後聯動頁面篩選
- 分類規則優先級採 manual override > manual alias > ai auto alias > fallback rule

### 7.2 不建議第一版處理

- 微服務拆分
- 自建身份系統
- 額外後台 CMS

## 8. 風險

- Google OAuth 在 Cloudflare 執行環境上的 session 管理需先驗證
- D1 migration 與本機開發流程需先定好
- 大型 CSV 匯入時需注意解析效能與錯誤回報體驗
- 若未控制資料量與函式用量，可能超出免費額度
- 若直接由前端呼叫模型 API，會暴露 API key，屬不可接受風險
- AI token 成本與速率限制需獨立評估
- 若未先定義 admin bootstrap 流程，第一版可能卡在無法安全建立管理者
- 若未定義資料粒度，前後端可能對「明細」有不同理解

## 9. 監控與成本控制

- 需監控 Cloudflare Pages Functions 調用量
- 需監控 D1 查詢量與失敗率
- 需監控 Google AI 使用量與錯誤率
- 當 AI 預算或免費額度接近上限時，應優先停用 AI 輔助功能，不影響主流程
- 第一版至少需保留 feature flag 與基本日誌，方便手動關閉 AI

建議門檻：

- 當 AI 額度達 80% 時記錄警告並顯示管理提醒
- 當 AI 額度達 90% 時預設停用 AI 自動建議，只保留核心流程
- 若 AI 連續失敗率過高，應自動切換為停用狀態並要求人工恢復
