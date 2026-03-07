# Icon System - Svelte5 + Tabler Icons

> 本專案使用 [`@tabler/icons-svelte`](https://github.com/tabler/tabler-icons) 作為圖示庫。

---

## 基本用法

每個圖示為獨立的 Svelte 元件，按需 import 即可，不會打包未使用的圖示。

```svelte
<script lang="ts">
  import { IconHeart, IconArrowLeft, IconPlayerPlay } from '@tabler/icons-svelte';
</script>

<IconHeart />
<IconArrowLeft />
<IconPlayerPlay />
```

---

## Props

| 屬性 | 型別 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `size` | `number` | `24` | 圖示尺寸（px）|
| `color` | `string` | `currentColor` | 圖示顏色，預設繼承文字顏色 |
| `stroke` | `number` | `2` | 線條粗細 |
| `class` | `string` | — | 自訂 CSS class |

```svelte
<IconHeart size={48} stroke={1} color="red" />
```

---

## 尋找圖示

前往 [tabler.io/icons](https://tabler.io/icons) 搜尋所需圖示名稱，再轉換為 PascalCase 即為 import 名稱。
