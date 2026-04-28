# 標籤路由對應 API 設計

## API 定位

現有 `/api/tags` 已經是標籤資源端點，但 GET 目前只回傳 `{ tags: TagInfo[] }`，主要服務 Autocomplete 與設定頁。新設計讓 `GET /api/tags` 成為標籤查詢的 canonical API，並保持既有輕量用途可用。

建議做法：

- `GET /api/tags` 改為呼叫 `queryTags(loaded.db, parseTagQueryParams(url))`。
- 預設 `sampleLimit=0`，所以舊的 Autocomplete 呼叫不會額外產生圖片樣本。
- response 同時提供 `items` 與 `tags`：新功能讀 `items`，舊邏輯可繼續讀 `tags`。
- `POST /api/tags` 與 `DELETE /api/tags` 維持現有 body contract，繼續負責全域重新命名與刪除。

## GET /api/tags

### 查詢參數

| 參數 | 範例 | 說明 |
| --- | --- | --- |
| `search` | `land` | 標籤名稱子字串搜尋 |
| `minCount` | `3` | 只列出使用次數大於等於 3 的標籤 |
| `maxCount` | `50` | 只列出使用次數小於等於 50 的標籤 |
| `sort` | `count` | `count`、`name`、`recent`、`random` |
| `order` | `desc` | `asc` 或 `desc`；`random` 時忽略 |
| `page` | `2` | 從 1 開始 |
| `limit` | `60` | 0 或省略表示不分頁 |
| `sampleLimit` | `5` | 每個標籤回傳幾張樣本圖片；Autocomplete 使用 0，標籤 grid 使用 5 |
| `sampleMode` | `stable` | `stable`、`recent`、`random` |

### 成功回應

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "name": "landscape",
        "count": 42,
        "lastUsedAt": 1760000000000,
        "samples": [
          {
            "id": "photo-a.jpg",
            "name": "Mountain Light",
            "width": 1920,
            "height": 1080,
            "blurhash": "LEHV6nWB2yk8pyo0adR*.7kCMdnj"
          }
        ]
      }
    ],
    "tags": [
      { "name": "landscape", "count": 42 }
    ],
    "total": 1,
    "page": 1,
    "pages": 1
  }
}
```

`tags` 是 `items` 的輕量 projection，主要用於相容既有 `tagCache`。如果呼叫方使用分頁或搜尋，`tags` 也只代表同一批查詢結果，不是全資料庫所有標籤。

### 錯誤回應

與現有 API 一致：

- 尚未設定或載入收藏庫：`503 { ok: false, error: "尚未載入資料庫" }`
- 無效 query 參數不需要回 `400`，parser 以白名單 fallback 或讓查詢回空集合。這與目前圖片 query 的寬鬆 URL 體驗一致，但 tag parser 應避免把非法 `sort` 原樣傳入查詢層。

## API handler 草圖

`src/routes/api/tags/+server.ts` 的 GET 可以變成：

```ts
export const GET: RequestHandler = ({ url }) => {
  const loaded = requireDatabase();
  if (!loaded) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const result = queryTags(loaded.db, parseTagQueryParams(url));
  const tags = result.items.map(({ name, count }) => ({ name, count }));

  return json({ ok: true, data: { ...result, tags } });
};
```

`POST` 與 `DELETE` 不需要跟著改，因為全域 rename/delete 已經以 tag name 為主體，且 settings page 也已經在成功後呼叫 `tagCache.invalidate()`。

## 前端 cache 相容

`src/lib/client/cache.ts` 的 `fetchTags()` 建議改成明確要求輕量查詢：

```ts
const res = await api.get<TagQueryResult & { tags?: TagInfo[] }>("/api/tags?sampleLimit=0");
if (!res.ok || !res.data) return [];
return res.data.tags ?? res.data.items.map(({ name, count }) => ({ name, count }));
```

這樣即使之後移除 `tags` alias，`tagCache` 仍能靠 `items` projection 運作。

## /tags 頁面的 SSR load

新增 `src/routes/tags/+page.server.ts`，直接使用伺服器查詢函式，不必繞 HTTP：

```ts
export const load: PageServerLoad = ({ url }) => {
  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=error");

  const result = queryTags(loaded.db, {
    ...parseTagQueryParams(url),
    sampleLimit: 5,
    sampleMode: "stable",
  });

  return {
    tags: result.items,
    total: result.total,
    page: result.page,
    pages: result.pages,
  };
};
```

這與首頁的 `queryImages(loaded.db, parseQueryParams(url))` 對稱，但保留標籤頁自己的 parser 與 type。

## 是否新增 /api/tags/[name]

第一版不需要新增 `GET /api/tags/[name]`。新的 grid 頁面只需要列表查詢；點擊卡片後可以導向 `/` 並套用 `includedTags=<tag>` 來瀏覽該標籤下的圖片。

若未來要做標籤詳情 modal 或 tag analytics，再新增單一標籤端點：

- `GET /api/tags/[name]`：回傳單一 `TagWithSamples` 與可選 co-occurrence 統計。
- `PATCH /api/tags/[name]`：語意上可取代現有 `POST /api/tags` rename，但需要考慮任意標籤名稱的 URL encoding 與相容性。
- `DELETE /api/tags/[name]`：可取代 body delete，但同樣建議放到下一階段。

## Contract 細節

- `count` 永遠是使用該標籤的 committed image 數量。
- `samples` 只包含 committed image，且只包含顯示卡片需要的最小欄位。
- `lastUsedAt` 以該標籤底下圖片最大的 `committedAt` 計算。
- `sampleLimit` 應 clamp 到合理上限，例如 0 到 12；`/tags` route 固定使用 5。
- `sampleMode=stable` 是 API 與 route 的建議預設，避免畫面每次導航都改變。
- `sort=random` 可以回傳隨機標籤排序，但不應自動把 `sampleMode` 也改成 random。

## README 更新建議

實作後 README 的頁面導覽可新增：

| 頁面 | 路徑 | 功能 |
| --- | --- | --- |
| **Tags** | `/tags` | 搜尋、篩選、排序標籤，以卡片 grid 查看使用次數與代表圖片 |

API 概覽中的 `/api/tags` 可更新為：

| 端點 | 方法 | 用途 |
| --- | --- | --- |
| `/api/tags` | GET / POST / DELETE | 查詢標籤（可含樣本圖片）/ 全域重新命名 / 全域刪除標籤 |
