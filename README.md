# SiteFlow v0.5 高級商務版

此版本延續 v0.4 的資料鍵值與核心功能，新增五種主題與淺色、深色、跟隨系統模式。外觀設定另存 `siteflow_appearance_v1`，不會覆蓋工程資料。

## 本機啟動

進入包含 `index.html` 的資料夾，在檔案總管地址列輸入 `cmd`，再執行：

```bat
py -m http.server 8000
```

瀏覽 `http://localhost:8000`。

## 免費發佈到 GitHub Pages

1. 先在舊版「備份與還原」匯出 JSON，妥善保管。
2. 註冊或登入 https://github.com/，建立 **Public** repository，例如 `siteflow-pwa`。
3. 點選 **Add file → Upload files**，將本資料夾中的 `index.html`、`app.js`、`styles.css`、`sw.js`、`manifest.webmanifest`、`icon.svg`、`README.md` 上傳到 repository 根目錄，按 **Commit changes**。
4. 到 **Settings → Pages → Build and deployment**，Source 選 **Deploy from a branch**，Branch 選 **main**，資料夾選 **/(root)**，按 **Save**。
5. 等待 GitHub Pages 部署完成，網址通常是 `https://你的帳號.github.io/siteflow-pwa/`。
6. 手機使用 HTTPS 網址開啟。iPhone Safari 點分享 → 加入主畫面；Android Chrome 點選選單 → 安裝應用程式或加入主畫面。

**重要：** GitHub Pages 是公開靜態網站，程式碼可被其他人讀取。資料仍只存在各自瀏覽器的 localStorage/IndexedDB，不會跨手機與電腦同步。不要放入 API 密鑰、真實客戶個資或敏感工程資料。

更新時上傳新檔覆蓋，若仍顯示舊版，關閉分頁再開啟，必要時在瀏覽器的網站資料設定中更新 Service Worker。清除網站資料會刪除本機資料，請務必先備份。
