# Image Manager — 專案初始化步驟

> **前提**：已在 `C:\Users\Summe\Documents\Projects\image-manager` 建立目錄，
> 舊專案原始碼已移至 `old-ref/`，尚未建立任何 SvelteKit 結構。

---

我作了以下操作:
```
PS C:\Users\Summe\Documents\Projects\image-manager> npx sv create .
Need to install the following packages:
sv@0.12.4
Ok to proceed? (y) y

┌  Welcome to the Svelte CLI! (v0.12.4)
│
◇  Directory not empty. Continue?
│  Yes
│
◇  Which template would you like?
│  SvelteKit minimal
│
◇  Add type checking with TypeScript?
│  Yes, using TypeScript syntax
│
◇  What would you like to add to your project? (use arrow keys / space bar)
│  sveltekit-adapter
│
◇  Which SvelteKit adapter would you like to use?
│  node
│
◆  Project created
│
◆  Successfully setup add-ons: sveltekit-adapter
│
◇  Which package manager do you want to install dependencies with?
│  npm
│
│  To skip prompts next time, run:
●  npx sv@0.12.4 create --template minimal --types ts --add sveltekit-adapter="adapter:node" --install npm .
│
◆  Successfully installed dependencies with npm
│
◇  What's next? ───────────────────────────────╮
│                                              │
│  📁 Project steps                            │
│                                              │
│    1: npm run dev -- --open                  │
│                                              │
│  To close the dev server, hit Ctrl-C         │
│                                              │
│  Stuck? Visit us at https://svelte.dev/chat  │
│                                              │
├──────────────────────────────────────────────╯
│
└  You're all set!
```


---

## 腳手架產生的檔案分析

> 本專案定位：**私人本地工具，不部署至雲端，不對外公開**。
> 以此為準，逐一判斷 `npx sv create .` 產生的額外檔案。

### 補充確認

腳手架已自動寫入，無需手動修改:
- `tsconfig.json` 已含 `strict: true`
- `package.json` 已含 `sveltekit-adapter-node` 相關依賴與設定好 `svelte.config.js` 的 adapter 配置

### 可直接刪除

```powershell
Remove-Item "README.md"
Remove-Item "static\robots.txt"
Remove-Item "src\lib\index.ts"
Remove-Item ".npmrc"
```

| 檔案 | 刪除理由 |
|------|----------|
| `README.md` | `sv` 通用模板說明，對私人工具無意義；重要資訊已在 `plan.md` / `init.md` |
| `static/robots.txt` | 搜尋引擎爬取規則；本地工具不對外公開，無需此檔 |
| `src/lib/index.ts` | 僅含一行說明注解的空佔位檔；`$lib` alias 由 SvelteKit config 處理，不依賴此檔存在 |
| `.npmrc` | `engine-strict=true` 要求 npm 嚴格遵守 `engines` 欄位，但 `package.json` 目前無 `engines` 宣告，設定目前無作用 |

### 下一步

依照 `plan.md` 的順序推進開發

參考 `old-ref/lib/` 中的原始實作，搬移並以 TypeScript 重寫。
