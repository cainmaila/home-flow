# Home Flow

Home Flow 是家庭支出分析 Web App。

第一版目標很單純：把橫向日期結構的家庭支出 CSV，轉成可讀、可查、可比較的月度支出分析，不做完整記帳系統。

## 專案現況

目前 repo 以產品文件為主，需求、架構、資料規則、任務拆解已完成，可直接交付開發。

- 目前內容：PRD、架構、資料規則、任務拆解、範例 CSV
- 目前尚未建立 SvelteKit 專案骨架
- 下一步應先做 M1：專案初始化、登入、D1、Cloudflare Pages 部署 PoC

## 第一版要解決問題

- 原始 CSV 橫向結構不易閱讀
- 無法快速回答當月總支出、分類排行、月比較、固定支出占比
- CSV 格式相近但不完全固定
- 單靠規則判斷不可靠，需保留人工校正

## 第一版範圍

### In Scope

- Google Login
- admin / viewer 角色
- repo 設定檔 allowlist
- CSV 手動上傳
- import preview -> commit 兩段式匯入
- 增量合併
- 分類別名映射
- 固定支出規則判斷與人工覆寫
- 月報摘要、分類排行、分類占比、月比較、月趨勢
- 明細查詢與過濾
- 匯入歷程
- RWD 介面

### Out of Scope

- 帳號註冊
- 後台角色管理介面
- 銀行或信用卡串接
- 即時協作
- 推播通知
- 匯入版本回復

## 核心原則

- 免費資源優先，不增加固定月費
- AI 只能做輔助，不能成為主流程唯一依賴
- AI 失效時，匯入、校正、報表仍必須可用
- allowlist 含 email，repo 必須維持 private
- 不保存原始 CSV，只保存解析結果、匯入摘要、匯入歷程

## 技術決策

- Frontend / BFF：SvelteKit
- Deployment：Cloudflare Pages
- Server Runtime：Cloudflare Pages Functions
- Database：Cloudflare D1
- Auth：Google OAuth
- AI：Google Gemini API

AI 第一版限制：

- 僅用於分類別名建議
- 預設模型為 Gemini 2.5 Flash-Lite 免費模型
- API key 只可存在 server 端環境變數
- 呼叫必須走 server route proxy
- 若免費額度、穩定性或政策限制不符預期，AI 功能可停用或延後

## 主要流程

1. 使用者以 Google 帳號登入。
2. 系統檢查 allowlist 與角色。
3. admin 上傳 CSV。
4. 系統解析、標準化、產生 preview。
5. 系統執行增量合併與 AI 分類建議。
6. admin 檢查衝突、更新候選、待確認項目。
7. admin 確認後 commit。
8. 系統更新報表、明細、匯入歷程。

## 資料模型摘要

第一版明細粒度不是發票級交易，而是 CSV 中單一有效金額儲存格。

每筆 expense 至少包含：

- household_id
- expense_date
- raw_category
- normalized_category
- amount
- is_fixed_expense
- source_import_id
- override_flags

增量合併規則：

- 同 household、同日期、同原始分類、同金額：視為重複
- 同 household、同日期、同原始分類、不同金額：視為更新候選
- 更新候選預設採新值，但必須先 preview 再 commit

## 里程碑

- M1：初始化 SvelteKit、Google OAuth、D1、Cloudflare Pages、session PoC
- M2：CSV 匯入、標準化、preview -> commit、匯入歷程
- M3：分類規則、人工校正、固定支出覆寫、AI 建議轉正流程
- M4：月報、分類圖表、月比較、月趨勢、明細過濾
- M5：AI 輔助功能、feature flag、fallback、額度控制

## 預計環境變數

- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- SESSION_SECRET
- D1_DATABASE_BINDING
- GOOGLE_AI_API_KEY
- AI_FEATURE_ENABLED
- SESSION_MAX_AGE_DAYS
- AI_AUTO_ACCEPT_THRESHOLD

## 文件入口

- [docs/Plan.md](docs/Plan.md)
- [docs/PRD.md](docs/PRD.md)
- [docs/prd/Architecture.md](docs/prd/Architecture.md)
- [docs/prd/Data-Rules.md](docs/prd/Data-Rules.md)
- [docs/prd/Tasks.md](docs/prd/Tasks.md)
- [docs/費用.csv](docs/%E8%B2%BB%E7%94%A8.csv)

## 開發順序建議

1. 先依 [docs/prd/Architecture.md](docs/prd/Architecture.md) 建立技術骨架。
2. 再依 [docs/prd/Data-Rules.md](docs/prd/Data-Rules.md) 實作匯入與標準化。
3. 最後依 [docs/prd/Tasks.md](docs/prd/Tasks.md) 逐里程碑開發與驗收。
