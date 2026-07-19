# Derived Reassignment Patterns

Svelte 5.25 起，`$derived` 宣告的值可以被暫時覆寫（reassign），當依賴變化時覆寫會被清除，重新回到衍生計算的結果。官方文件以樂觀更新（Optimistic UI）作為唯一範例，但這個特性其實可以衍生出更多 pattern。

---

## 核心機制

`$derived` 的值在被 reassign 後，會暫時脫離衍生計算，直到其依賴的響應式值發生變化為止：

```
依賴變動 → derived 重新計算（覆寫清除）→ 使用中 → 手動寫入（覆寫）→ 暫時脫離 derived → 依賴變動 → …
```

關鍵行為：

- **覆寫是暫時的**：一旦依賴變化，覆寫即被丟棄，值回到衍生計算結果。
- **覆寫期間仍是響應式的**：覆寫後的值仍會觸發依賴它的 `$effect` 或 `$derived`。
- **不可使用 `const`**：需要覆寫的 `$derived` 必須以 `let` 或 class field 宣告。

---

## Pattern 1：樂觀更新

[官方範例](https://svelte.dev/docs/svelte/$derived#Overriding-derived-values)。值衍生自伺服器資料，使用者操作時立即覆寫，API 失敗時手動 rollback。

```svelte
<script>
  let { post, like } = $props();

  let likes = $derived(post.likes);

  async function onclick() {
    likes += 1;
    try {
      await like();
    } catch {
      likes -= 1;
    }
  }
</script>

<button {onclick}>🧡 {likes}</button>
```

### 狀態流轉

```
伺服器資料 post.likes = 10
  → likes = 10                  ← derived 計算

使用者點擊
  → likes = 11                  ← 暫時覆寫（樂觀）

API 成功 → 伺服器更新 post.likes = 11
  → likes = 11                  ← derived 重新計算，與覆寫值一致

API 失敗 → catch
  → likes = 10                  ← 手動 rollback
```

覆寫在 API 成功時會被「等價替換」，伺服器資料追上覆寫值，derived 重新計算出相同結果。

---

## Pattern 2：表單欄位綁定

表單欄位的初始值衍生自某個記錄（如 SSR data、 URL search params），使用者可以編輯（覆寫），切換記錄時自動重置。

### 傳統做法

```ts
// $state + $effect
class Form {
  name = $state("");
  rating = $state(0);

  constructor(private opts: { get record(): Record | null }) {
    this.name = this.opts.record?.name ?? "";
    this.rating = this.opts.record?.rating ?? 0;

    $effect(() => {
      this.name = this.opts.record?.name ?? "";
      this.rating = this.opts.record?.rating ?? 0;
    });
  }
}
```

### derived 做法

```ts
class Form {
  name: string;
  rating: number;

  constructor(private opts: { get record(): Record | null }) {
    this.name = $derived(opts.record?.name ?? "");
    this.rating = $derived(opts.record?.rating ?? 0);
  }
}
```

使用者編輯時值被覆寫，切換記錄時依賴變化自動清除覆寫。不需要 `$effect`。

### 狀態流轉

```
選擇記錄 A
  → name = "A", rating = 3          ← derived 計算

使用者編輯名稱
  → name = "A (edited)"             ← 暫時覆寫

切換到記錄 B
  → name = "B", rating = 5          ← derived 重新計算，覆寫清除
```

---

## Pattern 3：偵測是否偏離來源

當一個可覆寫的 derived 值存在時，覆寫後的值與衍生來源之間的差異本身就是可觀測的。可以用另一個 `$derived` 來追蹤這個差異，判斷「當前值是否偏離了源頭」。

假設我們有以下需求:

```svelte
<input bind:value={form.name} />
<input type="number" bind:value={form.rating} />
{#if form.dirty}
  <button on:click={form.reset}>Reset</button>
{/if}
```

### 傳統做法

```ts
class Form {
  name = $state("");
  rating = $state(0);
  dirty = $state(false);

  constructor(private opts: { get record(): Record | null }) {
    this.name = this.opts.record?.name ?? "";
    this.rating = this.opts.record?.rating ?? 0;

    $effect(() => {
      const rec = this.opts.record;
      this.name = rec?.name ?? "";
      this.rating = rec?.rating ?? 0;
      this.dirty = false; // 切換記錄時重置 dirty
    });
  }

  handleInputChange() {
    this.dirty = true; // 使用者編輯時標記 dirty
  }

  reset() {
    const rec = this.opts.record;
    this.name = rec?.name ?? "";
    this.rating = rec?.rating ?? 0;
    this.dirty = false; // 手動覆寫回源頭值，重置 dirty
  }
}
```

```svelte
<input bind:value={form.name} oninput={form.handleInputChange} />
```

### derived 做法

```ts
class Form {
  name: string;
  rating: number;
  dirty: boolean;

  constructor(private opts: { get record(): Record | null }) {
    this.name = $derived(opts.record?.name ?? "");
    this.rating = $derived(opts.record?.rating ?? 0);

    this.dirty = $derived.by(() => {
      const rec = this.opts.record;
      if (!rec) return false;
      return this.name !== rec.name || this.rating !== rec.rating;
    });
  }

  reset() {
    const rec = this.opts.record;
    this.name = rec?.name ?? "";
    this.rating = rec?.rating ?? 0;
  }
}
```

`dirty` 同時追蹤覆寫值與源頭值，不管 `this.name` 是來自 derived 計算還是使用者覆寫，比較邏輯都一致。當記錄切換時，覆寫被清除，`dirty` 自動回到 `false`。

### 狀態流轉

```
選擇記錄 A（name: "A", rating: 3）
  → name = "A", rating = 3          ← derived 計算
  → dirty = false                   ← derived 計算（值與源頭一致）

使用者編輯名稱為 "A (edited)"
  → name = "A (edited)"             ← 暫時覆寫
  → dirty = true                    ← derived 重新計算（name 偏離源頭）

使用者點擊 Reset
  → name = "A", rating = 3          ← 手動覆寫回源頭值
  → dirty = false                   ← derived 重新計算（值與源頭一致）

切換到記錄 B（name: "B", rating: 5）
  → name = "B", rating = 5          ← derived 重新計算，覆寫清除
  → dirty = false                   ← derived 重新計算
```

---

## Pattern 4：載入狀態旗標

某個 UI 狀態（如 loading）在特定依賴變化時需要重置為預設值，在事件發生後被覆寫。

### 傳統做法

```ts
let loading = $state(true);

$effect(() => {
  src; // 依賴圖片 URL
  loading = true;
});

const onload = () => (loading = false);
```

每個需要在依賴變化時重置的狀態都得寫一個 `$effect`。

### derived 做法

```ts
let loading = $derived.by(() => {
  src; // 讀取依賴
  return true; // 永遠計算為 true
});

const onload = () => (loading = false);
```

`src` 變化時 derived 重新計算為 `true`（覆寫清除），`onload` 時被覆寫為 `false`。

### 狀態流轉

```
src = "photo-1.jpg"
  → loading = true              ← derived 計算

圖片載入完成
  → loading = false             ← 暫時覆寫

src = "photo-2.jpg"
  → loading = true              ← derived 重新計算，覆寫清除
```

---

## Pattern 5：分頁與篩選重置

分頁的當前頁碼衍生自某個預設值（通常是第一頁），篩選條件變化時自動重置，使用者翻頁時覆寫。

```ts
let { data } = $props();

let currentPage = $derived.by(() => {
  data.filter; // 篩選條件變化時重置
  return 1;
});

function goToPage(n: number) {
  currentPage = n;
}
```

### 狀態流轉

```
初始化，filter = { tag: "cat" }
  → currentPage = 1           ← derived 計算

使用者翻到第 3 頁
  → currentPage = 3           ← 暫時覆寫

使用者修改篩選條件 filter = { tag: "dog" }
  → currentPage = 1           ← derived 重新計算，覆寫清除
```
