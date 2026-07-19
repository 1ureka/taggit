# Taggit v3 規劃：複製 workbench、移植後端、分階段重寫路由

---

## 一、方案輪廓

Workbench 的前端基因（token 主題系統、原生 top-layer 浮層、元件 + `.core.svelte.ts` 架構）與 taggit 的後端基因（in-memory 資料庫、sharp 縮圖管線、blurhash、REST API、`query-spec`、`test/` 後端測試）已合體為單一新專案，沿用 `taggit` 專案名，版本進到 `3.0.0-dev`。`$lib` 下前端積木（`components`、`icons`、`assets`）與後端模組（`database`、`collection`、`image`、`mutation`、`query`、`query-spec`、`utils`）零改名並存；頁面只透過 `$lib/query-spec`、`$lib/image/client`、`$lib/utils` 與 `/api/**` 存取後端。舊 taggit 專案已停役，不再作為日常工具使用。

---

## 二、Phase 0：一次到位的建置

Phase 0 已完成：`package.json`（`name: "taggit"`、`3.0.0-dev`、`adapter-node`、`sharp`/`blurhash`/`@unpic/placeholder`、`test` script 接 `test/run.mjs`）、`app.html`（`lang="zh-TW"`、light/dark 雙主題 bootstrap）、`.gitignore`（`server.json` 不入版控）、後端整包移植（`database`/`collection`/`image`/`mutation`/`query`/`query-spec`/`utils`、`hooks.server.ts`、`api/**`）、全域殼層（`src/routes/(layout)/` + 根目錄 `+layout.svelte`/`+layout.server.ts`/`+error.svelte`）、widget 底座（`src/lib/components/widgets/`：`ConfirmDialog` 等）皆已就緒。

與原規劃的差異：**未保留 `/lab` 元件展示場**；業務頁也未另立 `(app)` 路由群組，而是直接放在 `src/routes/` 根目錄下（`settings`、`(home)`、`staged`、`tags`、`compare`、`player`）。

---

## 三、剩餘路由工作

- **`/staged`**：尚未補上圖章模式（cursor、徽章、Esc 等互動細節）。
- **`/committed`（原規劃中的 `/editor`）**：尚未遷移。
- **`/tags/cleanup`**：尚未遷移。
