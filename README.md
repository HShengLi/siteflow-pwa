# SiteFlow v0.6 — Supabase 單帳號雲端同步試用版

保留 v0.5 的工地、施工日報、照片、成本、施工權重與完成度、主題配色與本機備份。新增「雲端同步」頁面。

## 更新前
1. 在 v0.5 的「備份與還原」下載 **完整 JSON 備份（含照片）**，存到安全位置。
2. 先在測試網址上使用示範資料，不要儲存真實敏感工程資料。
3. 更新檔案後，原本同一網址的 `localStorage` / IndexedDB 會繼續保留；GitHub Pages 與 localhost 的資料互不相通。

## Supabase 設定（不需寫程式）
1. 開啟 https://supabase.com/dashboard ，建立新 Project，選擇區域、設定資料庫密碼並安全保存。等候建立完成。
2. 在 Supabase 左側 **SQL Editor** → **New query**，貼上 `supabase-setup.sql` 全文，按 **Run**。這會建立私有資料表、Row Level Security、原子版本檢查 RPC，以及私有照片儲存 bucket。
3. 在 **Authentication → Providers → Email** 確認 Email 登入已啟用。建議保持「Confirm email」啟用。
4. 在 **Authentication → URL Configuration**：Site URL 填寫你真正的 GitHub Pages 網址，例如 `https://你的帳號.github.io/siteflow-pwa/`。此版本採用 email + password，不依賴 redirect 登入。
5. 到 **Project Settings → API**（新版可能在 **Connect → API Keys**）找到 Project URL 和 **publishable key**（或舊版 `anon` public key）。把它們填入 `cloud-config.js` 的兩個引號內。
   - `window.SITEFLOW_SUPABASE_URL = 'https://xxxx.supabase.co';`
   - `window.SITEFLOW_SUPABASE_KEY = 'sb_publishable_xxx';`
   - **絕不可填 service_role、secret key 或資料庫密碼**，因為 GitHub Public repository 裡所有人都看得到程式碼。
6. 將全部網站檔案上傳到 GitHub repository 根目錄（**不要上傳 `supabase-setup.sql` 或任何密碼**；SQL 只在 Supabase SQL Editor 執行）。GitHub → Settings → Pages → Deploy from branch → main → /(root)。
7. 等部署完成後，在網站按 Ctrl+Shift+R，打開左側「雲端同步」。註冊 Email 帳號、完成驗證、登入。

## 首次同步流程（很重要）
- **舊電腦已有資料、雲端沒有資料**：先匯出完整 JSON 備份，再在舊電腦登入 → 雲端同步 → **立即上傳本機資料**。
- **手機要取得資料**：在手機登入相同帳號 → **下載雲端資料**。此操作會覆蓋手機上既有資料，先備份手機資料。
- 之後在已經選擇上傳/下載的裝置上修改資料，程式會在約 1.3 秒後嘗試自動上傳。**請確認顯示「已同步至雲端」再關閉頁面。**
- 換到另一裝置時，**先按「下載雲端資料」再編輯**。目前不提供即時推播與多裝置合併，不可同時在兩台裝置編輯。
- 若出現 `revision_conflict`：代表雲端版本已變更，請先匯出本機備份，再下載雲端資料，手動核對差異。

## 已知限制與安全提醒
- 這是**單一使用者**試用版，沒有公司組織、角色權限、邀請員工、即時協作、離線衝突合併、背景同步、稽核紀錄。
- 登入資訊儲存在瀏覽器 localStorage；共用電腦請登出，且不要在公共裝置使用。正式商業化前需做專業資安與隱私審查。
- 工地 JSON 快照上限約 4MB；照片每張 10MB，存在私有 Supabase Storage。照片同步需網路，且大批照片可能耗時。
- 刪除照片後雲端舊物件暫不清理，會佔用 Storage；後續版本需加安全的清理流程。
- 仍需定期使用「備份與還原」下載完整備份。不要將 JSON 備份上傳到公開 GitHub repository。
- 如果未設定 `cloud-config.js`，本機功能仍可正常使用，但雲端同步不可用。

## 本機啟動
在 `index.html` 所在資料夾開啟 CMD：

```cmd
py -m http.server 8000
```

然後開啟 http://localhost:8000 。

## 更新檔案
GitHub repository → Add file → Upload files → 上傳網站根目錄中的 `index.html`, `styles.css`, `app.js`, `cloud.js`, `cloud-config.js`, `manifest.webmanifest`, `sw.js`, `icon.svg`, `README.md`。`supabase-setup.sql` 不必上傳。


## v0.6.1 施工項目調整
- 標題改為「施工項目」。
- 移除手動權重及手動完成度選項，統一採用分項預算權重與施工數量完成度。
- 舊資料不會自動覆蓋：開啟編輯頁時，舊手動進度以「總量 100、完成數量 = 舊完成度」作為暫時顯示；舊預算缺漏時按原權重估算分項預算。請先核對數量與預算再儲存。
- 原有 localStorage key、雲端資料格式、照片與日報功能保持不變。更新前請先備份 JSON。
