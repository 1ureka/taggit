# Q5 — 標籤 metadata 的「讀」放哪?(CQRS 的乾淨度)

> 這題最小,但不釘會讓 CQRS 的「query/mutation 互不依賴」在標籤 metadata 上破一個小洞。

## 一句話問題

`getTagMeta`(讀標籤 metadata)今天住在 **`mutation.ts`**,而 query.ts 又有一份幾乎一樣的 `tagMetaOf`。
CQRS 落地後,**讀**不該住 mutation。這份讀該歸誰?

## 現況:同一個讀,兩個地方各寫一份

```ts
// mutation.ts —— 一個「讀」卻住在寫模組
export function getTagMeta(db: Database, name: string): TagMeta {
  return { ...DEFAULT_TAG_META, ...db.data.tags[name] };
}

// query.ts —— 幾乎一模一樣,只是叫別的名字、private
function tagMetaOf(db: Database, name: string): TagMeta {
  return { ...DEFAULT_TAG_META, ...db.data.tags[name] };
}
```

兩者邏輯相同(補預設值後回傳),差別只在:
- `mutation.getTagMeta` 是**公開**的,給 [api/tags](../../src/routes/api/tags/+server.ts) 在 `setTagMeta` 之後讀回合併結果:
  ```ts
  database.setTagMeta(name, { hidden: body.hidden });
  return json({ ok: true, data: { name, ...database.getTagMeta(name) } });
  ```
- `query.tagMetaOf` 是**私有**的,`queryTags` 逐標籤附 meta 時用。

## 為什麼是個問題

計畫 §2:「`query` 與 `mutation` **互不依賴**,都只依賴 `database`。這是 CQRS 落到模組層級。」

一個**讀**(`getTagMeta`)住在 mutation,有兩個副作用:
1. 呼叫端為了「讀一筆 tag meta」得 import `mutation` —— 語意錯位(讀為什麼要碰寫模組)。
2. 同一段補預設值的邏輯在 query / mutation 各一份 —— 就是計畫想消滅的「多個真相來源」。

而「補預設值」(`{ ...DEFAULT_TAG_META, ...raw }`)本質是**儲存格式的正規化**,`DEFAULT_TAG_META` 也已經住在 `schema.ts`(計畫說 schema.ts 留在 database 當「儲存格式」)。

## 選項

### 選項 A(建議):把「讀 tag meta 並補預設」下沉為 `database` 原語

```ts
// lib/database(schema.ts 或原語面)
export function tagMetaOf(db, name: string): TagMeta {
  return { ...DEFAULT_TAG_META, ...db.data.tags[name] };
}
```

- query 的 `queryTags` 附 meta 時呼叫它;mutation 完全不需要 `getTagMeta` 了。
- api/tags 那個「setTagMeta 後讀回」的呼叫,改成:寫走 `mutation.setTagMeta`、讀走 `database.tagMetaOf`(或 query)。
- 理由:補預設值 = 儲存格式正規化 = database 的職責(跟 `parseDBData` 同性質),`DEFAULT_TAG_META` 也在那。query / mutation 共用同一個原語,零重複。

### 選項 B:讀歸 `query`

把 `tagMetaOf` 公開成 `query.getTagMeta`,mutation 那份刪掉,api/tags 讀走 query。

- 也合理(讀就是 query 的事)。但 `queryTags` 內部本來就要用它,放 query 內順;缺點是「補預設」這個**純儲存格式**的邏輯離開了 database,和 `DEFAULT_TAG_META` 分兩地。

### 選項 C:維持現況

- mutation 繼續持有一個公開的讀。CQRS 的「互不依賴」在這一點上有例外。不建議。

## 順帶一提:`setTagMeta` 本身是寫,毫無疑問留 mutation

這題只在搬「讀」。`setTagMeta`(合併寫入 + `pruneTagMeta` + markDirty)是不折不扣的寫,留在 mutation。
`pruneTagMeta` 目前在 schema.ts,是儲存格式正規化(維持稀疏),留在 database 由 mutation 呼叫即可。

## 我的建議

**選項 A。** 把「讀 tag meta + 補預設」當成 **database 原語**下沉,query 與 mutation 都向 database 拿。
理由最一致:它跟 `DEFAULT_TAG_META`、`pruneTagMeta`、`parseDBData` 是同一類「儲存格式正規化」,本就屬 database;
順手消滅 query/mutation 的重複,並讓 mutation 不再對外露出任何「讀」。

## 你的回答

<!-- 在這裡寫下你的決定與理由 -->
