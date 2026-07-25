# 捲動時內容重繪：診斷與處置手冊

> 撰寫日期：2026-07-25 ｜ 對象：Chromium / Chrome（Blink + cc）
>
> 適用情境：DevTools → Rendering → **Paint flashing（繪製閃爍）** 顯示你捲動時整片內容都在重繪。

---

## 0. TL;DR：三張卡片

1. **不透明背景色要加在「真的有 `overflow` 的那個元素」身上。** 加在父層沒用，加在子層沒用，半透明沒用。這是投報率最高的一招，通常一行解決。
2. **`scrollbar-gutter: stable` 與 composited scroll 互斥**（在偏好 LCD 次像素文字的平台，例如 Windows 100~125% 縮放）。它會讓純色背景無法被搬進捲動內容的座標空間。
3. **Paint flashing 是唯一可信的判準；「滾動效能問題」的橘框只是提示，而且會誤報。** 橘框說「這個 scroller 沒被合成」，但沒被合成 ≠ 會重繪。

---

## 1. 心智模型：這其實是三個獨立的問題

很多人（包含大部分文章）把「捲動順不順」當成一個布林值，於是遇到矛盾的觀察就解釋不了。實際上要分三層問：

| | 問題 | 誰回答 | 症狀 |
| --- | --- | --- | --- |
| **Q1** | 這個 scroll node 有沒有被標記為 `is_composited`？ | Rendering → Scrolling performance issues 的**橘框** | 沒有 → 畫出 `raster-inducing scroll (not bad)` 淺橘框 |
| **Q2** | 捲動內容有沒有落在**自己的合成層**裡？ | 只有 Paint flashing 能回答 | 沒有 → 捲動時整片變綠 |
| **Q3** | 有沒有東西在每次捲動時把 paint 標成失效？ | Paint flashing + Performance 錄製 | 有 → 即使 Q1/Q2 都過關，還是會有東西閃 |

**關鍵：Q1 和 Q2 是獨立的。** 一個 scroll node 即使沒被合成（Q1 = 否），只要它的捲動內容因為某個 direct compositing reason 而自成一層（Q2 = 是），捲動就只是改那一層的 transform，**完全不需要重新 raster**。反之，一個被合成的 scroller 也可能因為 Q3 而每格重繪。

這就是為什麼你會覺得勾選「滾動效能問題」有點失真——它只回答 Q1。橘框標籤裡那句 `(not bad)` 其實就是 Chromium 自己在說「這不一定是問題」。

順便釐清三種橘框（顏色都很像，很容易混看）：

| 標籤 | 外觀 | 意思 |
| --- | --- | --- |
| `raster-inducing scroll (not bad)` | 淺橘、邊框半透明 | Q1 = 否。**框一定是整個 scroller 容器**（形狀取自 scroll node 的 container rect） |
| `main thread scroll repaint: <原因>` | 深橘、邊框實心 | 更糟：每格要回主執行緒重繪。框也是整個容器 |
| `main thread scroll hit test` | 亮橘 | **與重繪無關**，只是命中測試要回主執行緒。框是任意區域，常常只有捲軸那一條 |

---

## 2. 五分鐘診斷流程

### Step 0：先確認你在看的真的是那個 scroller

Elements 面板會在可捲動元素旁標 `scroll` badge。實務上非常容易誤判（以為在捲那個 div，其實在捲 `html`，或反過來）。

### Step 1：Paint flashing，看綠色的**形狀**

| 你看到的 | 結論 |
| --- | --- |
| 完全不閃 | 真正的 composited scroll，收工 |
| 只有邊緣一條閃 | composited scroll + 新 tile 進場，正常且無需處理 |
| 只有捲軸那一條閃 | 自訂捲軸（見 §4.1），內容本身沒事 |
| **整片內容閃** | 要處理，往 Step 2 |
| 整片閃且 Performance 錄製顯示主執行緒每格都有 Paint | 最糟的一層，優先看 §4 |

### Step 2：下探針，把問題二分

在 scroller **內部**包一層 wrapper，給它 `will-change: transform`：

```html
<div class="scroller">          <!-- overflow-y: auto -->
  <div style="will-change: transform">  <!-- 探針 -->
    …原本的內容…
  </div>
</div>
```

- **綠色消失** → 這是**合成決策**問題（Q1/Q2）→ 照 §3 的清單修，修好後把探針拿掉。
- **綠色不變** → 這是**每格 paint 失效**問題（Q3）→ 照 §4 找兇手。探針解決不了 Q3。

這一步很重要，因為兩類問題的處置方式完全不同，而症狀（整片綠）一模一樣。

### Step 3（選用）：確認是不是卡在 LCD 文字那條規則

用這個旗標另開一個瀏覽器實例跑同一頁：

```
chrome.exe --user-data-dir=%TEMP%\lcdtest --enable-prefer-compositing-to-lcd-text <URL>
```

若綠色整片消失，就確認問題出在「為了保留次像素文字渲染而放棄合成」這條路徑。這也解釋了為什麼同一份程式碼在 Mac 或高 DPI 螢幕上完全沒事——那些平台不強制偏好 LCD 文字，於是**所有** scroller 直接合成。**跨平台開發時務必在 Windows 低 DPI 環境驗一次。**

---

## 3. 處置清單 A：讓 scroller 恢復合成

按「檢查成本」排序。前六項都是一行 CSS 的事。

### 3.1 scroller 自己要有**不透明**的 `background-color` ← 最重要

判斷條件是「捲動內容的第一個 paint chunk 必須有一個覆蓋整個捲動內容範圍的不透明矩形」，而唯一能覆蓋整個捲動內容（不只是可視區）的東西，就是**scroller 自己的背景色**被搬進捲動內容的座標空間。

因此：

- ✅ 加在 `overflow-y: auto` 的那個元素上
- ❌ 加在它的父層（父層背景屬於另一個 box，幫不上忙）
- ❌ 加在它的子元素上（子元素的背景只蓋住自己那塊，蓋不住整個 scroll 高度）
- ❌ `hsl(… / 0.85)`、`rgba(…, .9)` 這類半透明（等於沒有）
- ⚠️ 視覺上不想改變外觀時，就填**和父層一模一樣的顏色**，這是零視覺成本的效能修正

### 3.2 `scrollbar-gutter` 必須是 `auto`（預設值）

只要不是 `auto`，Blink 就不做「純色背景視為 local、可搬進捲動內容空間」的最佳化，3.1 直接失效。

想要「捲軸出現時版面不跳動」的替代方案：
- 用 `overflow-y: scroll` 讓捲軸常駐（版面同樣穩定，且不觸發這條）
- 或用 overlay 捲軸（不佔版面寬度）
- 或自己留 `padding-right`

### 3.3 不能有 `inset` 的 `box-shadow`

inset 陰影畫在背景之上、而且不跟著捲動，所以背景只能留在 border box 空間。改用外層元素模擬（在 scroller 的父層放一個 `position: absolute` 的漸層遮罩，`pointer-events: none`）。

### 3.4 不能有 `border-image`、`border-shape`，也不要與父層的 `preserve-3d` 狀態不一致

同樣都會強制背景留在 border box 空間。

### 3.5 scroller 必須**真的**溢出

內容塞得進容器時，Blink 直接放棄把背景搬進捲動內容空間。這通常無害（不會捲的東西不會有捲動重繪），但要注意：**橘框仍然會畫出來**，別被它嚇到。這正是「選項少的下拉選單被整片標橘卻毫無影響」的成因。

### 3.6 絕對不要 `background-attachment: fixed`

這會直接掉到最糟的一層（深橘 `main thread scroll repaint`），而且對 `html` 捲動同樣有效——它是少數能讓 root scroller 也變爛的寫法。

### 3.7 不要在 scroller 的**第一個**子元素上放 `opacity` / `filter` / `transform`

判斷條件除了不透明矩形，還要求那個 chunk 的 transform / clip / effect 節點都與 scroller 一致。若 3.1 做好了（背景存在），這條通常自動成立；若你沒有背景色，那麼第一個子元素只要帶 `opacity: 0.5` 之類就一定失敗。

### 3.8 逃生門：`will-change: transform`

當上面全部檢查完還是失敗（或你根本不想動 CSS 結構），就在**捲動內容的 wrapper** 上放 `will-change: transform`。內容整包變成獨立合成層，捲動只是移動那一層 → 不重繪。

代價要知道：
- 一個永久的合成層 + GPU 記憶體（內容越大越貴）
- layer 數量增加
- **這不是「提示」，是行為變更**：它讓祖先 scroller 的重繪行為改變。所以請加註解說明它兼任效能用途，否則後人看到「動畫早就結束了，`will-change` 是多餘的」而刪掉，整頁會瞬間退化成捲動全重繪。

也因此要反過來警覺：**專案裡那種 `.fade-in { animation: …; will-change: transform, opacity }` 的通用動畫 class，很可能正在無意間扛著某個頁面的捲動效能。** 刪除任何 `will-change` 前，先用 Paint flashing 確認一次。

---

## 4. 處置清單 B：每格 paint 失效的來源

探針無效時看這裡。這些是「合成與否都會重繪」的東西。

### 4.1 自訂捲軸（`::-webkit-scrollbar`）

只要寫了 `::-webkit-scrollbar` 規則，該捲軸就是 `CustomScrollbar`，而 `MayCompositeScrollbar()` 對它直接回傳 false ——**永遠不會有自己的合成層**。於是 thumb 每次移動都得由普通繪製處理。

症狀：捲動時**只有捲軸那一條**在閃，或出現只圈住捲軸的 `main thread scroll hit test` 橘框。

這是正常的、且成本極低（那條區域很窄）。要完全避免只能改用原生捲軸或 overlay 捲軸。**不要為了消滅這條而放棄自訂捲軸樣式，不值得。**

### 4.2 捲動事件驅動的 style 修改

任何 `onscroll` 裡改 class / inline style 的程式碼都會製造每格重繪。改用：
- CSS scroll-driven animations（`animation-timeline: scroll()`）
- IntersectionObserver（只在跨越門檻時改，不是每格改）

### 4.3 真的有東西變了

例如捲動指示器切換 active 章節——那本來就該重繪，**不是問題**。判準是「重繪範圍是否等於實際變化的範圍」。若只有指示器那一小塊在閃，就是正確行為。

### 4.4 `position: sticky` 子元素

每次捲動位移都會執行 `InvalidatePaintForStickyDescendants()`，但它做的是重算 sticky offset 並標記 **paint property 更新**，不是重繪整個元素；而且 sticky 元素本身會取得 `kStickyPosition` 這個 direct compositing reason 而自成一層。所以 sticky 通常**不是**整片重繪的兇手，別誤殺。

### 4.5 疊在捲動內容上的 `backdrop-filter`

毛玻璃 sticky header / 半透明遮罩層：它的輸出依賴下方內容的位置，捲動就必須重算。若它是 scroller 的**兄弟節點**（絕對定位的遮罩層）而非內容的一部分，影響會小很多；若它壓在捲動內容上方，代價很高。

---

## 5. 信心標記

| 論述 | 信心 | 依據 |
| --- | --- | --- |
| Q1 與 Q2 是獨立的兩件事；橘框只回答 Q1 | 高 | 橘框判定式為 `!is_composited && repaint reasons == 0`；實測案例三驗證 |
| 三種橘框的形狀/顏色/語意 | 高 | `cc/trees/debug_rect_history.cc`、`debug_colors.cc`、`heads_up_display_layer_impl.cc` |
| §3.1 背景必須在 scroller 本身且不透明 | 高 | `ComputeNeedsCompositedScrolling` 第 ⑥ 條 + 實測案例四 |
| §3.2 `scrollbar-gutter` 非 auto 會失效 | 高 | `ComputeBackgroundPaintLocation` 的 `IsScrollbarGutterAuto()` 分支 + 實驗檔實測 |
| §3.3 / §3.4 / §3.5 / §3.6 | 高 | 同一函式的其他分支；§3.5、§3.6 另有實測 |
| §3.8 wrapper 上的 `will-change` 有效 | 高（實測） | 實測案例三；機制為「內容自成合成層，捲動只改 transform」 |
| `will-change: transform` 放在 **scroller 自己**身上也有效 | 中（實測有效、機制未定位） | 實驗檔實測有效，但 `kDirectReasonsForScrollTranslationProperty` 只含 `kRootScroller \| kOverflowScrolling`，我沒能在原始碼中定位確切路徑。**建議優先放在 wrapper 上** |
| §4.1 自訂捲軸永不合成 | 高 | `MayCompositeScrollbar()`：`if (scrollbar.IsCustomScrollbar()) return false;` |
| §4.4 sticky 不是整片重繪的主因 | 中高 | `InvalidatePaintForStickyDescendants()` 只做 `SetNeedsPaintPropertyUpdate()` 與 sticky offset 重算 |

---

## 參考來源

- [How cc Works — Chromium docs](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/how_cc_works.md)
- [cc/input/README.md — Chromium](https://chromium.googlesource.com/chromium/src/+/HEAD/cc/input/README.md)
- [cc/input/main_thread_scrolling_reason.h](https://raw.githubusercontent.com/chromium/chromium/main/cc/input/main_thread_scrolling_reason.h)
- [cc/trees/scroll_node.h](https://raw.githubusercontent.com/chromium/chromium/main/cc/trees/scroll_node.h)
- [blink/renderer/platform/graphics/paint/cull_rect.cc](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/platform/graphics/paint/cull_rect.cc)
- [blink/common/features.cc](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/common/features.cc)
- [blink/renderer/core/page/scrolling/README.md](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/page/scrolling/README.md)
- [Chromium commit：\[RasterInducingScroll\] status="test"](https://chromium.googlesource.com/chromium/src/+/23f66e92e05663760c7b7b26000af129c1e3b35b)
- [cc/trees/debug_rect_history.cc](https://raw.githubusercontent.com/chromium/chromium/main/cc/trees/debug_rect_history.cc)（畫框邏輯）
- [cc/debug/debug_colors.cc](https://raw.githubusercontent.com/chromium/chromium/main/cc/debug/debug_colors.cc)（三種橘的 RGBA）
- [cc/layers/heads_up_display_layer_impl.cc](https://raw.githubusercontent.com/chromium/chromium/main/cc/layers/heads_up_display_layer_impl.cc)（`"raster-inducing scroll (not bad)"` 字串出處）
- [cc/trees/property_tree.cc](https://raw.githubusercontent.com/chromium/chromium/main/cc/trees/property_tree.cc)（`CanRealizeScrollsOnPendingTree`）
- [blink paint_artifact_compositor.cc](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/platform/graphics/compositing/paint_artifact_compositor.cc)（`ComputeNeedsCompositedScrolling`）
- [blink property_tree_manager.cc](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/platform/graphics/compositing/property_tree_manager.cc)
- [blink paint_layer_scrollable_area.cc](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/paint/paint_layer_scrollable_area.cc)（`PrefersNonCompositedScrolling`、`MayCompositeScrollbar`）
- [blink layout_box.cc](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/layout/layout_box.cc)（`ComputeBackgroundPaintLocation`）
- [blink switches.h](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/public/common/switches.h)（`--enable/disable-prefer-compositing-to-lcd-text`）
- [Slimming Paint（Composite After Paint 前身）](https://www.chromium.org/blink/slimming-paint/)
- [RenderingNG architecture — Chrome for Developers](https://developer.chrome.com/docs/chromium/renderingng-architecture)
- [Discover issues with rendering performance（Rendering 面板）— Chrome DevTools](https://developer.chrome.com/docs/devtools/rendering/performance)
- [New scroll badge in DevTools](https://developer.chrome.com/blog/swe-devtools-scroll-badge)
- [Impl-side painting / Multithreaded Rasterization](https://www.chromium.org/developers/design-documents/impl-side-painting/)
