# Q4 — `TagQuery.scope` 的「有」vs「無」是正確性關鍵

> 這是最該寫測試守住的一點。§3 把兩根語意軸 collapse 成一個訊號,漂亮但脆弱。

## 一句話問題

計畫用「`TagQuery` 有沒有帶 `scope`」單一訊號,同時決定「count 怎麼算」與「要不要遮蔽」。
`fromSearchParams` 從空 URL 解析時,會產出**「存在的空 scope」**還是**「沒有 scope」**?
這兩者語意相反,一旦被抹平就靜默算錯。

## §3 定的規則

| `TagQuery.scope` | 語意 | count 怎麼算 |
|---|---|---|
| **帶 scope**(present) | facet 讀取 | 在「該 scope 篩選 + hidden 遮蔽後」的圖片集內計算;hidden 標籤取「解鎖 N 張」投影數 |
| **不帶 scope**(absent) | 獨立列表 | 該標籤的**原始總使用數**(不管圖片是否隱藏) |

計畫用**粗體**強調的判準:

> **判準是 present vs absent,不是 empty vs non-empty**:全新圖庫的側欄仍帶一個**空的 `ImageWhere`** → 算 facet → 仍遮蔽。**帶空物件 ≠ 不帶。**

## 為什麼這很脆弱

這把今天**兩個顯式欄位**(`TagQueryOptions.hidden: "mask"|"ignore"` + count 模式)壓成**一個訊號**(scope 在不在)。
好處是少一根軸、少一個荒謬組合;壞處是這個訊號**藏在型別的 optional 裡**(`scope?: ImageWhere`),
而 `undefined` 跟 `new ImageWhere()`(空但存在)在很多地方看起來一樣,很容易被某個 `?? new ImageWhere()` 或 `fromSearchParams` 默默抹平。

## 現有兩種呼叫端剛好對映(我驗過)

這是好消息 —— 現況的兩種用法乾淨落在 present / absent 兩側:

```ts
// A. 側欄 facet(present):home / editor —— 帶 params
// src/routes/(home)/+page.server.ts
const facets = database.queryTags(url.searchParams);          // 有 scope → 遮蔽 + facet count

// B. 編寫/管理(absent):tagger / settings / editor authoringTags —— 不帶 params
// src/routes/tagger/+page.server.ts
database.queryTags(undefined, { hidden: "ignore", universe: "all" });   // 無 scope → 原始 count
```

- A 即使是**全新圖庫、篩選全空**,`url.searchParams` 仍在 → 要產出**存在的空 scope** → 仍遮蔽。
- B 是明確地**不給 scope** → 原始 count。

新設計要保住的,就是「A 的空 ≠ B 的無」。

## 陷阱長什麼樣(具體)

```ts
class TagQuery {
  scope?: ImageWhere;
  static fromSearchParams(params: URLSearchParams): TagQuery {
    const q = new TagQuery();
    q.scope = ImageWhere.fromSearchParams(params);   // ← 永遠產出「存在的空 ImageWhere」,即使 params 全空
    // …若這裡寫成「params 沒有任何篩選 key 時 scope = undefined」就錯了:
    //   會讓全新圖庫的側欄從 facet 掉成獨立列表 → hidden 標籤不再遮蔽 → 洩漏隱藏圖數量
    return q;
  }
}
```

反過來,B 路徑(authoring)**絕不能**走 `fromSearchParams`,要直接建**沒有 scope** 的 TagQuery:

```ts
// authoring 側:明確不帶 scope
const q = new TagQuery();   // q.scope === undefined
q.universe = "all";
```

## 需要你拍板的

### 4a. `fromSearchParams` 的契約

確認:`TagQuery.fromSearchParams(params)` **永遠**產出 `scope = 存在的(可能為空的)ImageWhere`,
**絕不**因「params 沒有篩選 key」而退化成 `scope = undefined`。
→ 意思是:凡是「從 URL 來的側欄查詢」一律 present、一律遮蔽。這是你要的嗎?(我認為是)

### 4b. 「absent」怎麼在型別/建構上表達得夠顯眼

`scope?: ImageWhere` 的 optional 太安靜。要不要用更難搞錯的表達,例如:
- (i) 維持 `scope?: ImageWhere`,靠**測試**與**註解**守住(最輕);
- (ii) 兩個具名建構子:`TagQuery.facet(where)` vs `TagQuery.standalone()` —— 讓「有沒有 scope」變成**呼叫端顯式選的動詞**,而不是「填不填一個 optional 欄位」;
- (iii) 顯式 discriminant 欄位(等於把剛 collapse 掉的軸又加回來 —— 不建議,違背 §3 初衷)。

### 4c. 測試清單(至少這幾條)

- [ ] 全新空圖庫 + 空 params → `queryTags` 走 facet → hidden 標籤仍遮蔽(count 為「解鎖 N 張」而非原始數)。
- [ ] 帶 `includedTags=[某hidden標籤]` → 該標籤解除遮蔽、其餘 hidden 仍遮蔽。
- [ ] authoring 路徑(無 scope)→ hidden 標籤回**原始總使用數**、不遮蔽、含 `universe:"all"` 的 ghost 標籤。
- [ ] 「空 scope」與「無 scope」對同一個 hidden 標籤產出**不同** count(這條直接測住 present≠absent)。

## 我的建議

- **4a**:是,確立這個契約。凡從 URL 來的一律 present、一律遮蔽——這正是 §3「image 側一律遮蔽以免洩漏隱藏圖」的延伸。
- **4b**:採 **(ii) 具名建構子**。`TagQuery.facet(imageWhere)` / `TagQuery.standalone()` 讓語意軸變成**呼叫端寫得出來、讀得懂**的動詞,`scope` 是不是 undefined 變成內部細節而非呼叫端要小心的 optional。這是把「脆弱的隱式訊號」變「顯式但仍單軸」的最佳折衷,不違背 collapse 的初衷。
- **4c**:四條測試全要,尤其最後一條(present≠absent)是這整個 collapse 的守門測試。

## 你的回答

<!-- 4a: -->

<!-- 4b: -->

<!-- 4c: -->
