# 不標準製作 — Bô Piau Tsun Tsè-Tsok

Yu-Fang LAI 與 Wei-Cheng HSU 的作品網站，收錄共同及個人創作、寫作、經歷與作品集。

使用 HTML、CSS 與 JavaScript 製作，透過 GitHub Pages 發布，無須建置。

## 本機預覽

```sh
python -m http.server 8080 --bind 127.0.0.1
```

開啟 <http://127.0.0.1:8080/>。

## 維護

- 介紹、作品、經歷與文章：`data.json`
- 上線圖片：`asset/optimized/`，尺寸對照：`image-manifest.js`
- 作品集：`asset/*.pdf`，來源設定：`reader.js`
- 上傳前檢查：`npm run check`，不需要安裝前端套件。
- 完整維護與部署方式：[維護說明](docs/maintenance.md)

大型原圖與本機測試產物已由 `.gitignore` 排除；以 Git／GitHub Desktop 提交時會自動套用。透過網頁手動上傳時，需自行排除這些檔案。

部分作品的角色／分工資料仍可補充。
