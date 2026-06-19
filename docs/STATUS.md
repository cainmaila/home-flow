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
- [ ] T1.3 Google OAuth + session | 依賴: T1.2 | 狀態: todo
      驗收: admin/viewer 各自登入後 `/session/me` 回對應角色
- [ ] T1.4 角色守衛 | 依賴: T1.3 | 狀態: todo
      驗收: viewer 打修改型 API 得 403
- [ ] T1.5 Cloudflare Pages 部署 + session PoC | 依賴: T1.4 | 狀態: todo
      驗收: push 後自動上線；重整／關開瀏覽器 7 天內登入不失；secret 不進前端 bundle

## M2 — 匯入與標準化

- [ ] T2.1 CSV 上傳頁 + 大小限制 | 依賴: T1.5 | 狀態: todo
      驗收: >10MB 被前端拒絕
- [ ] T2.2 CSV parser | 依賴: T2.1 | 狀態: todo
      驗收: 能解出 `docs/費用.csv` 全部有效儲存格；用末欄合計交叉驗證
- [ ] T2.3 欄位語意辨識 | 依賴: T2.2 | 狀態: todo
      驗收: 相近格式樣本仍可解析
- [ ] T2.4 標準化為 expense 模型 | 依賴: T2.3 | 狀態: todo
      驗收: 產出符合 schema 的列
- [ ] T2.5 preview→commit + 增量合併 | 依賴: T2.4 | 狀態: todo
      驗收: 同檔重匯 inserted=0、duplicate=全部；改一格金額重匯出現 1 筆更新候選
- [ ] T2.6 import job + 匯入摘要 + 歷程 | 依賴: T2.5 | 狀態: todo
      驗收: commit 後歷程列出時間、匯入者、筆數、狀態
- [ ] T2.7 錯誤分級 | 依賴: T2.2 | 狀態: todo
      驗收: 壞日期／壞金額／空分類觸發 blocking 並清楚提示

## M3 — 分類與校正

- [ ] T3.1 標準分類表 + 預置分類 | 依賴: T1.1 | 狀態: todo
      驗收: seed 後存在基本分類
- [ ] T3.2 分類別名映射 + 待確認清單 | 依賴: T3.1 | 狀態: todo
      驗收: 未匹配 raw_category 進待確認
- [ ] T3.3 分類決策優先級 | 依賴: T3.2 | 狀態: todo
      驗收: 四層各有測試案例命中對應層
- [ ] T3.4 人工修正 + 固定支出覆寫 | 依賴: T3.3 | 狀態: todo
      驗收: 覆寫後報表即時反映
- [ ] T3.5 規則回寫 + 套用後續匯入 | 依賴: T3.4 | 狀態: todo
      驗收: 確認後重匯，原待確認項自動套用

## M4 — 報表與明細

- [ ] T4.1 月報首頁 | 依賴: T3.5 | 狀態: todo
      驗收: 數字與 D1 聚合一致
- [ ] T4.2 分類排行 + 占比圖 | 依賴: T4.1 | 狀態: todo
      驗收: 占比加總 100%
- [ ] T4.3 月比較 + 月趨勢圖 | 依賴: T4.1 | 狀態: todo
      驗收: 比較差異正確
- [ ] T4.4 明細查詢與過濾 | 依賴: T4.1 | 狀態: todo
      驗收: 四種過濾各自正確
- [ ] T4.5 圖表點擊聯動 | 依賴: T4.2, T4.3, T4.4 | 狀態: todo
      驗收: 點分類後明細同步、再點還原
- [ ] T4.6 RWD | 依賴: T4.5 | 狀態: todo
      驗收: 窄寬視窗皆可用

## M5 — AI 輔助

- [ ] T5.1 Gemini server proxy | 依賴: T2.6 | 狀態: todo
      驗收: 前端 bundle 無 key；前端無直連第三方
- [ ] T5.2 feature flag | 依賴: T5.1 | 狀態: todo
      驗收: 關閉後匯入／校正／報表照常
- [ ] T5.3 限流 + fallback + 自動停用 | 依賴: T5.2 | 狀態: todo
      驗收: 模擬失敗時降級不崩
- [ ] T5.4 匯入後 AI 分類建議 | 依賴: T5.3, T3.2 | 狀態: todo
      驗收: 高信心自動採納、低信心需人工確認
- [ ] T5.5 額度監控 | 依賴: T5.4 | 狀態: todo
      驗收: 模擬額度觸發對應行為
