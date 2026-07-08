import type { Tag } from "$lib/database/client.js";

// SvelteKit 的環境型別擴充。
// 詳見 https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    interface PageData {
      /**
       * 目前查詢語境下的標籤 facet 計數，由各頁面的 server load 提供。
       * 自動完成等元件直接消費此欄位（SSR faceted search 的資料來源）。
       */
      facets?: Tag[];
    }
  }
}

export {};
