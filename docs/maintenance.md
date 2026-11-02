# 維護說明

Yu-Fang LAI 與 Wei-Cheng HSU 的靜態作品網站。使用 HTML、CSS 和原生 JavaScript，無須建置或安裝前端套件。

## 本機預覽

在網站根目錄執行：

```sh
python -m http.server 8080 --bind 127.0.0.1
```

開啟 <http://127.0.0.1:8080/>。請透過 HTTP 預覽，不要直接雙擊 HTML：作品資料與 PDF 閱讀器需要從網頁伺服器載入。

## 上傳前檢查

需要 Node.js 18 或更新版本，不需要 `npm install`：

```sh
npm run check
```

也可以直接執行 `node scripts/check-site.mjs`。檢查涵蓋 JavaScript 語法、站內檔案、大小寫、作品資料、圖片尺寸版本與團體介紹。它不會宣稱已驗證外部服務、PDF 實際顯示或所有瀏覽器版面。

如已安裝 Chrome 或 Edge，可執行 `npm run smoke`，在背景檢查代表性頁面／尺寸，並將畫面與結果存到已被 Git 忽略的 `.site-review/`。`npm run smoke -- --subpath --all-works` 會額外模擬 GitHub Pages 專案子目錄，並逐件檢查所有作品的手機及桌面版、圖片是否載入。其他安裝位置可用 `PORTFOLIO_BROWSER` 環境變數指定瀏覽器。這項檢查會啟動只綁定本機的暫時伺服器，結束後關閉。

## 檔案分工

| 檔案 | 用途 |
| --- | --- |
| `index.html`、`script.js`、`styles.css` | 互動控制台、點陣頭像、接線與個人介紹側欄 |
| `works.html`、`works.js` | 作品索引、作者篩選、Writing 與 Profiles & CV |
| `work.html`、`work.js` | 個別作品、媒材／角色資料、圖片輪播 |
| `works.css` | 作品索引、個人經歷與作品詳情的版面 |
| `reader.html`、`reader.js`、`reader.css` | PDF 封面選單與浮層閱讀器 |
| `base.css` | 共用字體、輔助文字與團體介紹元件 |
| `navigation.css` | 全站桌面與手機導覽 |
| `shared.js` | 資料載入、文字轉義、作品查找、響應式圖片與介紹渲染 |
| `data.json` | 人物、團體介紹、作品與文章內容 |
| `image-manifest.js` | 自動產生的 WebP 尺寸對照表 |
| `asset/optimized/` | 上線使用的響應式圖片 |
| `asset/*.pdf` | 作品集 PDF |
| `scripts/` | 上傳前檢查與圖片處理工具，不是網站執行依賴 |

## 更新內容

- 人名、簡介、學經歷、作品與文章：修改 `data.json`。
- 團體對話：修改 `profiles.group.conversation`；`aside: true` 表示動作旁註。
- 作品的 `role` 填實際參與工作；沒有資料的欄位留空，頁面會略過。
- 每個作品需要唯一 `id`。不同作者可以引用同一件作品；同一位作者下不要重複 `id`。
- 個人作品連結可使用 `works.html?person=a`、`works.html?person=b`；團體為 `?person=group`。
- 作品集來源與顯示名稱在 `reader.js` 頂端的 `BOOKS`。
- PDF 論文在 `writings` 填入 `id`、`pdf`、`projectId`，並將 `link` 設為 `reader.html?paper=該文章id`。網站會沿用浮層閱讀器，並在對應作品頁提供入口。
- Instagram 網址在 `data.json` 各人的 `instagram` 欄位；首頁插孔的連結也需同步更新於 `index.html`。

## 圖片更新

大型原始 JPG／PNG 保留在本機，`.gitignore` 會排除它們。Git 和網站使用 `asset/optimized/` 內的 WebP。**PDF 不會被忽略。**

新增或更換圖片時：

1. 將原始圖片放到 `asset/`，在 `data.json` 填入它的相對路徑。
2. 圖片處理工具需要 Python 3.10+ 與 Pillow：`python -m pip install Pillow`。
3. 執行 `python scripts/optimize-images.py`。
4. 將更新的 `image-manifest.js` 和 `asset/optimized/` 一起提交。
5. 執行 `npm run check`。

工具保留原始檔，也保留對照表中本機沒有原始檔的既有項目，方便從新複製的儲存庫加入圖片。檔名請避免只以大小寫區分。

## 部署

這是靜態網站：將根目錄中的四個 HTML 頁面、所有根目錄 CSS／JS、`data.json`、`.nojekyll` 和 `asset/` 發布到靜態主機即可。**不需要 build command，也沒有 `dist/`。**

使用相對路徑，因此可以放在網域根目錄或專案子目錄。不要把所有網址改寫到 `index.html`；作品頁使用 `work.html?id=…`，閱讀器使用 `reader.html?book=…`。

`.gitignore` 排除本機預覽圖片、瀏覽器暫存、原始大型圖片與私有環境設定。首次上傳前仍請檢查 Git 的待提交清單。

### 新帳號與公開 GitHub repo

1. 使用 GitHub Desktop 登入新帳號，將網站資料夾建立成新的儲存庫並發布，選擇 Public。若使用整理好的上傳 ZIP，先解壓縮，確認 `index.html` 直接位於儲存庫根目錄；不要只把 ZIP 本身上傳。
2. 在 GitHub 的 Settings → Pages，Source 選 Deploy from a branch，Branch 選 `main`、`/ (root)`，儲存後等待發布。
3. 一般專案網址為 `https://新帳號.github.io/儲存庫名稱/`；若儲存庫名稱是 `新帳號.github.io`，則直接使用 `https://新帳號.github.io/`。網站使用相對路徑，換帳號無須修改程式。
4. 發布完成後，以新網址確認首頁、作品、Email 複製及 PDF；本機檢查不能取代實際部署後的確認。

GitHub Free 的 Pages 使用公開儲存庫。程式、`data.json`、PDF 和已上傳素材都能被其他人查看；`hidden: true` 只控制網頁顯示，不保護資料。依原設定保留的實習經歷仍會出現在 JSON 裡。公開網站的圖片及 PDF 也不能透過隱藏下載按鈕真正禁止取得。

目前最大的 PDF 約 32.7 MB，超過 GitHub 網頁上傳的單檔 25 MiB 限制；請使用 GitHub Desktop／Git 提交。所有發布檔案目前都小於一般 Git 儲存庫的單檔 100 MiB 限制，不需 Git LFS。參考：[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[檔案大小限制](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)。

## 目前已知的內容缺口

- 部分作品尚未填入角色／分工；頁面不會代填推測內容。

## 外部依賴與最後確認

- 字體來自 Google Fonts；無法連線時使用備用字體。
- PDF.js 3.11.174 及其 worker 目前由 cdnjs 載入；沒有改成本機套件。所有 PDF 載入都明確停用 `isEvalSupported`，採用 [Mozilla 公告的緩解設定](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq)。閱讀器僅開啟設定好的作品集與 `data.json` 中有 `pdf` 欄位的文章。請在實際部署網址確認封面、開書、翻頁、關閉與手機閱讀均成功。
- YouTube／Vimeo 等嵌入影片需要各自服務可正常連線。
- 圖片與閱讀器停用一般右鍵、拖曳與部分另存操作；這是操作介面的限制，公開發布的圖片／PDF 仍能被取得或截圖。
- 上線前以手機和桌面確認導覽、作者篩選、作品圖片、Email 複製與 PDF 閱讀，並核對需要公開的人名與聯絡資訊。

## PDF 閱讀操作

首頁游標使用 `asset/cursors/` 中的 32px 點陣 SVG。像素圖案定義在 `scripts/build-cursors.py`，執行 `python scripts/build-cursors.py` 即可重新產生整套；熱點座標與變數在 `base.css`，物件對應在 `styles.css`。

- 點文件左／右半邊：上一頁／下一頁；底部翻頁按鈕與鍵盤方向鍵仍可使用。
- 手機：雙指縮放文件，放大後單指拖曳；雙點可放大或還原。
- 桌面：Ctrl／⌘ + 滾輪縮放文件，或使用 +／−；雙擊可放大或還原。
- `Fit` 回到整頁大小，`Width` 將目前頁面貼齊閱讀區寬度。
- 縮放範圍限於閱讀器，不調整瀏覽器頁面倍率。
- `npm run test:reader` 可檢查縮放、拖曳、單點／雙點、翻頁與取消手勢。

論文連結預設在目前頁面的浮層閱讀器開啟，保留作者篩選、網址及原本閱讀位置；關閉後會回到觸發連結。獨立的 `reader.html?paper=…` 網址仍可用來直接分享。全站一般連結／按鈕使用 PRESS 游標，聯絡資訊使用插頭，閱讀區與拖曳狀態沿用同系列游標。
