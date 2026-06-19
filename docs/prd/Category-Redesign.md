# 分類系統重設計 PRD

## 1. 動機

現行系統使用 22 個硬編碼標準分類（`categories.ts`）。用戶無法自定義分類，AI 也只能從固定清單中挑選。本次重設計讓分類完全由用戶掌控。

## 2. 現狀

| 元件 | 位置 | 問題 |
|------|------|------|
| 硬編碼分類 | `src/lib/config/categories.ts` | 不可自定義 |
| category_aliases | DB table | 映射 raw → 固定清單 |
| category_overrides | DB table | 單筆覆寫，仍限固定清單 |
| AI prompt | `src/lib/server/ai/gemini.ts` | 候選清單寫死在 prompt |
| 校正頁 | `corrections/+page.svelte` | 下拉選單來自 `STANDARD_CATEGORIES` |

## 3. 目標設計

### 3.1 兩層分類架構

```
大類（parent）
 └─ 子類（child）  ← 必填
```

- 每筆費用必須選到子類層級
- 大類不可直接用於費用，僅作分組
- 報表可按大類聚合，也可按子類展開

### 3.2 分類屬性

每個分類（大類與子類）包含：

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| id | integer | auto | 主鍵 |
| name | text | Y | 顯示名稱，UNIQUE(parent_id, name) |
| description | text | N | 大類用：簡短說明此分類涵蓋範圍，AI 參考用 |
| icon | text | N | emoji 或文字，無限制格式 |
| color | text | N | hex 色碼 `^#[0-9a-fA-F]{6}$`，預設 #808080 |
| parent_id | integer | N | null = 大類，FK → categories.id |
| sort_order | integer | Y | 同 parent 內排序，新增時 max+1 |
| is_deleted | boolean | Y | 軟刪除，預設 false |

約束：
- UNIQUE(parent_id, name) — 同大類下不可重名
- parent_id 僅允許指向 parent_id IS NULL 的記錄（防止循環）
- 子類不繼承大類的 icon/color，各自獨立

### 3.3 預設分類（Seed Tree）

用戶完全可改可刪，seed 只是起點。

```
食 — 所有吃喝相關，含外食、食材採買、飲料零食
 ├─ 早餐
 ├─ 午餐
 ├─ 晚餐
 ├─ 飲料
 ├─ 食材
 ├─ 水果
 └─ 零食

衣 — 服飾、鞋包、配件等穿戴相關
 └─ 其他

住 — 居住相關開銷，含水電瓦斯、日用消耗品
 ├─ 日用品
 ├─ 瓦斯
 ├─ 水
 └─ 電

行 — 日常通勤與大眾運輸
 └─ 交通

育 — 教育、學習、書籍、課程
 └─ 其他

樂 — 休閒娛樂、社交活動
 ├─ 外出
 └─ 彩券

醫療 — 看診、藥品、健康檢查
 └─ 醫療

固定支出 — 每月固定合約型支出，如保險、貸款、訂閱服務
 ├─ 保險
 ├─ 貸款
 └─ 訂閱

汽車 — 車輛相關費用，含油資、保養、停車
 └─ 加油
```

9 大類、22 子類。遷移時現有 `STANDARD_CATEGORIES` 文字值對應到上述子類 ID。

### 3.4 刪除策略

**子類刪除：**
- 軟刪除（`is_deleted = true`）
- 已引用該子類的費用 → `normalized_category` 設為 NULL（「未分類」）
- 指向該子類的 `category_aliases` → 軟刪除
- 指向該子類的待處理 `ai_suggestions` → 自動拒絕（status = 'rejected'）
- 校正頁自動浮出未分類費用供重新分配

**大類刪除：**
- 連帶軟刪除所有子類（cascade soft-delete）
- 子類的刪除邏輯同上
- 刪除前提示受影響的子類數量與費用筆數

**「未分類」定義：**
- `normalized_category IS NULL`，非特殊分類記錄
- UI 顯示「未分類」標籤/chip

## 4. 分類編輯器

### 4.1 位置

新頁面：`/settings/categories`

### 4.2 功能

| 操作 | 說明 |
|------|------|
| 新增大類 | 輸入名稱，可選 icon/color |
| 新增子類 | 在大類下新增 |
| 改名 | inline 編輯 |
| 改 icon/color | 色盤 + emoji 文字輸入 |
| 刪除 | 軟刪除，提示受影響筆數（大類時含子類數） |
| 拖曳排序 | 大類間、子類間可拖曳 |

### 4.3 權限

僅管理者可操作。viewer 看不到此頁。

## 5. 費用分類選擇

現行所有使用 `STANDARD_CATEGORIES` 下拉選單的地方改為：

- 從 DB 讀取用戶自定義分類（`WHERE is_deleted = false`）
- 兩層級聯選擇：先選大類 → 再選子類
- 校正頁、匯入預覽、單筆覆寫均適用

## 6. AI 分類調整

### 6.1 候選清單改為動態

AI prompt 不再硬編碼分類清單，改為從 DB 讀取當前所有非刪除子類，格式：

```
可用分類：
- 食（所有吃喝相關，含外食、食材採買、飲料零食）> 早餐
- 食 > 午餐
- 住（居住相關開銷，含水電瓦斯、日用消耗品）> 日用品
- 汽車（車輛相關費用，含油資、保養、停車）> 加油
...
```

### 6.2 歷史範例自動注入

AI prompt 自動附帶各分類的歷史歸類範例，讓 AI 學習用戶的分類習慣：

```
過去分類範例：
- 「早餐」常見項目：麥當勞早餐、7-11、全家
- 「午餐」常見項目：鼎泰豐、八方雲集、便當
...
```

實作方式：
- 查詢 `category_aliases` 表，按 `category_id` 分組
- 每個子類取最近 10 筆已確認（source = 'manual' 或 'ai_auto'）的 `raw_category`
- 僅包含非刪除分類（`WHERE categories.is_deleted = false`）
- 無歷史範例的新分類仍列入候選清單，標註「無歷史範例」
- Token 上限 4000，超過時截斷低頻分類的範例（保留候選名稱）

### 6.3 相容性

- AI 功能仍可整體停用，不影響手動分類
- 候選清單為空（用戶未建立任何分類）時跳過 AI 建議

## 7. 遷移計畫

### 7.1 DB 遷移

1. 新增 `categories` 表（schema 見 3.2）
2. Seed 上述 9 大類 + 22 子類
3. `category_aliases.normalized_category` TEXT → `category_id` INTEGER FK → categories.id ON DELETE SET NULL
4. `category_overrides.override_category` TEXT → `category_id` INTEGER FK → categories.id ON DELETE SET NULL
5. `expenses.normalized_category` TEXT → `category_id` INTEGER FK → categories.id ON DELETE SET NULL
6. `fixed_expense_rules.normalized_category` TEXT → `category_id` INTEGER FK → categories.id ON DELETE SET NULL
7. 遷移現有資料：文字分類名 → 對應 seed 子類 ID（無對應者設 NULL）
8. 孤立的待處理 `ai_suggestions`（suggested_category 文字無對應）→ 自動拒絕

### 7.2 程式碼遷移

1. 刪除 `src/lib/config/categories.ts`（硬編碼清單）
2. `resolveCategory()` 第四層 fallback 改為查 DB `WHERE is_deleted = false` 而非 `STANDARD_CATEGORY_SET`
3. 所有前端下拉選單改為 API 動態載入兩層結構
4. AI `buildPrompt()` 改為動態讀取分類 + 歷史範例注入
5. 報表聚合邏輯支援按大類/子類兩級聚合
6. 新增 `/settings/categories` 頁面與 CRUD API

## 8. 影響範圍

| 區域 | 影響 |
|------|------|
| DB schema | 新增 categories 表，4 張表改 FK |
| 分類解析 | resolveCategory 查 DB 而非常數 |
| 校正頁 | 下拉改動態兩層選擇 |
| 報表 | 支援按大類/子類聚合 |
| AI prompt | 動態候選 + 歷史範例注入 + 4000 token cap |
| 匯入流程 | 分類解析改查 DB |
| 新增頁面 | /settings/categories 編輯器 |

## 9. 不做的事

- 不做無限層級巢狀（只做兩層）
- 不做多用戶各自獨立分類（單一家庭共用）
- 不做分類預算上限
- 不做分類模板市集
- 不做分類匯入匯出
- 不做 seed 分類保護（完全可改可刪）
- 不做分類併發編輯衝突處理（單管理者系統）
