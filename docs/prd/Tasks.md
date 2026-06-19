# Home Flow 任務拆解

## 1. 可開工標準

當前需求已滿足以下開工條件：

- 產品型態已確認
- 技術選型已確認
- 部署位置已確認
- 權限角色已確認
- 匯入策略已確認
- 第一版功能邊界已確認
- 免費資源優先原則已確認

以下任務已拆到可直接執行。

## 2. 里程碑

### M1 基礎骨架

目標：建立可部署、可登入、可連資料庫的空殼系統。

任務：

- 初始化 SvelteKit 專案
- 接入 Cloudflare adapter
- 設定 GitHub -> Cloudflare Pages 部署
- 建立 D1 migration 與本機開發設定
- 完成 Google OAuth 登入
- 建立 session 與角色檢查
- 建立 admin bootstrap seed 流程
- 建立 repo 設定檔式 allowlist 與角色載入機制
- 完成 Cloudflare Pages 上的 Google OAuth + session 穩定性 PoC
- 驗證部署與資料層是否可維持在免費額度內
- 驗證 server route 可安全讀取 secret 環境變數

完成判定：

- admin 可登入
- viewer 可登入
- 首次 push 可自動部署到 Cloudflare Pages
- 不需額外付費即可完成首版上線
- secret 不會暴露到前端 bundle
- Google OAuth session 可在 Cloudflare Pages 上穩定維持約 7 天

### M2 匯入與標準化

目標：可上傳 CSV 並轉成結構化支出資料。

任務：

- 實作 CSV 上傳頁
- 實作 CSV parser
- 實作欄位語意辨識
- 實作標準化轉換
- 明確落地儲存格級明細模型
- 實作 import preview 與 import commit 兩段式流程
- 實作增量合併策略
- 實作匯入歷程摘要
- 定義並實作 CSV 上傳大小限制
- 儲存 import job 與匯入摘要

完成判定：

- 可成功匯入 [docs/費用.csv](docs/%E8%B2%BB%E7%94%A8.csv)
- 能處理日期範圍變化與分類增減
- 匯入失敗時能顯示清楚錯誤
- 開發與產品對明細粒度沒有歧義

### M3 分類與校正

目標：讓自動解析結果可修正，建立可用資料品質。

任務：

- 建立標準分類表
- 建立分類別名映射
- 實作待確認資料列表
- 實作分類人工修正
- 實作固定支出人工覆寫
- 實作規則優先級
- 實作 AI 建議到人工確認的轉正流程

完成判定：

- 管理者可修正分類
- 管理者可調整固定支出標記
- 修正後報表會即時更新
- 人工確認後的規則可影響後續匯入

### M4 報表與明細

目標：完成第一版核心分析體驗。

任務：

- 實作月報首頁
- 顯示當月總支出
- 顯示分類排行
- 顯示分類占比圖
- 顯示與上月比較
- 顯示月趨勢圖
- 實作支出明細查詢與過濾
- 支援圖表點擊聯動篩選
- 製作桌機與手機可用版面

完成判定：

- 使用者可在 5 分鐘內完成匯入與查看月報
- viewer 可讀取報表但不可修改資料

### M5 AI 輔助功能

目標：在不破壞主流程與免費優先原則下，提供可關閉的 AI 輔助能力。

任務：

- 定義 AI 功能只作為輔助，不作為主流程硬依賴
- 建立 server route 代理 Google AI 呼叫
- 以環境變數讀取 GOOGLE_AI_API_KEY
- 實作基礎限流、錯誤處理與 fallback
- 實作 feature flag，允許完全停用 AI
- 定義 AI 建議資料結構與審核狀態
- 實作高信心自動採納與低信心待確認流程
- 將採納結果寫入 category_aliases

補充原則：

- 若 Google Gemini 免費額度驗證不通過，M5 可延後，不阻擋 M1 至 M4 上線

完成判定：

- 前端不直接接觸 API key
- AI 失敗時主流程仍可運作
- AI 功能可由設定關閉
- AI 建議不會繞過人工確認直接污染正式資料

## 3. 任務執行順序

建議順序如下：

1. 專案初始化與部署骨架
2. 驗證 Google OAuth、Pages 與 D1 是否都能走免費方案
3. 落地資料表 schema
4. 完成 CSV 匯入流程
5. 完成標準化與增量合併
6. 完成校正頁
7. 完成報表頁
8. 完成 AI server proxy 與 fallback 設計
9. 完成監控、免費額度檢查與 AI 降級控制
10. 完成權限驗證與整體測試

## 4. 資料表建議

至少包含以下資料表：

- households
- users
- expenses
- imports
- category_aliases
- category_overrides
- fixed_expense_overrides
- ai_suggestions

## 5. 驗收清單

- Google Login 可用
- 角色權限正確
- D1 migration 可重現
- Cloudflare Pages 自動部署可用
- [docs/費用.csv](docs/%E8%B2%BB%E7%94%A8.csv) 可匯入
- 相近格式 CSV 可匯入
- 月報正確顯示總支出、排行、占比、月比較
- 明細頁可過濾
- 月趨勢圖可用
- 圖表點擊可聯動篩選
- 匯入歷程可顯示時間、匯入者、筆數、狀態
- 首版部署與運作不依賴付費方案
- 若啟用 AI，API key 不會暴露到前端
- 若停用 AI，核心流程仍可正常使用
- 首位 admin 可透過 seed 安全建立
- 匯入衝突一定先預覽再提交
- 低信心 AI 建議需人工確認後才寫入正式資料
- allowlist 僅在 private repo 情境下使用

## 6. 仍需在實作時決定的細節

以下細節不阻礙開工，但需在實作中定案：

- 圖表套件選型
- D1 schema 欄位命名細節
- 明細過濾器欄位與 UI 形式
- 免費額度監控與告警方式
- AI 請求額度、快取與降級策略
