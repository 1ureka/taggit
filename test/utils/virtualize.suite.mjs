/**
 * @file virtualize.suite.mjs
 * 通用虛擬化引擎（$lib/utils/virtualize.core.ts）：權重式貪婪欄位分配（createVirtualizeLayout）、
 * 二分搜尋可視項目（createVirtualizeContent）、單項目像素位置（getItemPixelRect）。
 *
 * 重點覆蓋 proportional／fixed 兩種 sizing 模式的差異：fixed 模式的像素高度必須不受
 * viewportEl 寬度影響（這是讓同一套演算法同時支援瀑布流與固定列高清單的關鍵），
 * 且二分搜尋的視口邊界換算也必須套用同一個係數，否則捲動到中段會找錯可見範圍。
 */

export const name = "virtualize (createVirtualizeLayout / createVirtualizeContent / getItemPixelRect)";

export async function run(t, h) {
  const { createVirtualizeLayout, createVirtualizeContent, getItemPixelRect } = h.modules;
  const { makeViewport } = h;

  // ── createVirtualizeLayout：空項目 ──
  {
    const layout = createVirtualizeLayout({ items: [], columns: 3 });
    t.eq("空項目時各欄為空陣列", layout.tracks, [[], [], []]);
    t.eq("空項目時 yMax 為 0", layout.yMax, 0);
  }

  // ── createVirtualizeLayout：proportional（預設）模式的貪婪欄位分配 ──
  let proportionalLayout;
  {
    const items = [
      { id: "a", width: 100, height: 100 }, // heightRatio 1
      { id: "b", width: 100, height: 50 }, // heightRatio 0.5
      { id: "c", width: 100, height: 200 }, // heightRatio 2
    ];
    proportionalLayout = createVirtualizeLayout({ items, columns: 2 });

    t.eq(
      "a 進第 0 欄（初始兩欄同高，取第一個最短欄）",
      proportionalLayout.tracks[0].map((t) => t.item.id),
      ["a"],
    );
    t.eq(
      "b、c 依序進第 1 欄（第 1 欄較短）",
      proportionalLayout.tracks[1].map((t) => t.item.id),
      ["b", "c"],
    );
    t.eq("a 的權重座標為 [0, 1]", [proportionalLayout.tracks[0][0].yStart, proportionalLayout.tracks[0][0].yEnd], [0, 1]);
    t.eq("c 接續 b 之後，權重座標為 [0.5, 2.5]", [proportionalLayout.tracks[1][1].yStart, proportionalLayout.tracks[1][1].yEnd], [0.5, 2.5]);
    t.eq("yMax 為最高欄的權重高度 2.5", proportionalLayout.yMax, 2.5);
  }

  // ── createVirtualizeLayout：fixed 模式，項目不需要 width/height ──
  let fixedLayout;
  {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    fixedLayout = createVirtualizeLayout({ items, columns: 1, sizing: { mode: "fixed", itemHeight: 56 } });

    t.eq(
      "fixed 模式三個項目依序疊在單一欄",
      fixedLayout.tracks[0].map((t) => [t.item.id, t.yStart, t.yEnd]),
      [
        ["a", 0, 56],
        ["b", 56, 112],
        ["c", 112, 168],
      ],
    );
    t.eq("yMax 為三個固定列高之和 168", fixedLayout.yMax, 168);
  }

  // ── createVirtualizeContent：早退保護 ──
  {
    const emptyResult = createVirtualizeContent({ layout: { tracks: [], yMax: 0 }, viewportEl: makeViewport() });
    t.eq("tracks 為空時回傳空結果", emptyResult, { visibleItems: [], contentHeight: 0 });

    const zeroYMaxResult = createVirtualizeContent({ layout: { tracks: [[]], yMax: 0 }, viewportEl: makeViewport() });
    t.eq("yMax 為 0 時回傳空結果", zeroYMaxResult, { visibleItems: [], contentHeight: 0 });

    const zeroWidthResult = createVirtualizeContent({ layout: fixedLayout, viewportEl: makeViewport({ clientWidth: 0 }) });
    t.eq("viewportEl 寬度為 0 時回傳空結果", zeroWidthResult, { visibleItems: [], contentHeight: 0 });
  }

  // ── createVirtualizeContent：proportional 模式的像素換算 ──
  {
    const layout = createVirtualizeLayout({
      items: [{ id: "a", width: 1, height: 1 }, { id: "b", width: 1, height: 1 }],
      columns: 1,
    });
    const viewportEl = makeViewport({ clientWidth: 300, clientHeight: 1000 });
    const { visibleItems, contentHeight } = createVirtualizeContent({ layout, viewportEl });

    t.eq("兩個等權重項目皆可見", visibleItems.map((i) => i.id), ["a", "b"]);
    t.eq("contentHeight 為 yMax(2) × 欄寬(300)", contentHeight, 600);
    t.eq(
      "a 的樣式字串（像素座標 = 權重 × 欄寬）",
      visibleItems[0].style,
      "position: absolute; left: 0px; top: 0px; width: 300px; height: 300px; transform: translate3d(0px, 0px, 0);",
    );
    t.eq(
      "b 緊接在 a 之下",
      visibleItems[1].style,
      "position: absolute; left: 0px; top: 0px; width: 300px; height: 300px; transform: translate3d(0px, 300px, 0);",
    );

    const wider = createVirtualizeContent({ layout, viewportEl: makeViewport({ clientWidth: 600, clientHeight: 1000 }) });
    t.eq("proportional 模式：欄寬加倍，contentHeight 等比例放大", wider.contentHeight, 1200);
    t.eq("proportional 模式：欄寬加倍，項目像素高度等比例放大", wider.visibleItems[0].pixelH, 600);
  }

  // ── createVirtualizeContent：fixed 模式的像素高度不受欄寬影響（固定列高清單的關鍵行為） ──
  {
    const narrow = createVirtualizeContent({
      layout: fixedLayout,
      viewportEl: makeViewport({ clientWidth: 300, clientHeight: 1000 }),
      sizing: { mode: "fixed", itemHeight: 56 },
    });
    const wide = createVirtualizeContent({
      layout: fixedLayout,
      viewportEl: makeViewport({ clientWidth: 900, clientHeight: 1000 }),
      sizing: { mode: "fixed", itemHeight: 56 },
    });

    t.eq("fixed 模式：contentHeight 不受欄寬影響", narrow.contentHeight, wide.contentHeight);
    t.eq(
      "fixed 模式：每個項目的像素高度不受欄寬影響",
      narrow.visibleItems.map((i) => i.pixelH),
      wide.visibleItems.map((i) => i.pixelH),
    );
    t.eq("fixed 模式：像素高度就是 itemHeight 本身", narrow.visibleItems[0].pixelH, 56);
    t.eq("fixed 模式：項目寬度仍隨欄寬撐滿（清單每列佔滿容器寬）", narrow.visibleItems[0].pixelW, 300);
    t.eq("fixed 模式：欄寬變動時寬度確實不同", wide.visibleItems[0].pixelW, 900);
  }

  // ── createVirtualizeContent：fixed 模式捲動到中段時二分搜尋範圍要正確 ──
  {
    // 捲動到 [100, 156)：a=[0,56) 已捲出、b=[56,112) 與 c=[112,168) 皆與可視範圍重疊
    const viewportEl = makeViewport({ clientWidth: 300, clientHeight: 56, scrollTop: 100 });
    const { visibleItems } = createVirtualizeContent({
      layout: fixedLayout,
      viewportEl,
      sizing: { mode: "fixed", itemHeight: 56 },
    });

    t.eq("捲動到中段時只有 b、c 可見（a 已捲出視口）", visibleItems.map((i) => i.id), ["b", "c"]);
  }

  // ── createVirtualizeContent：gap 樣式注入 ──
  {
    const layout = createVirtualizeLayout({ items: [{ id: "x" }], columns: 1, sizing: { mode: "fixed", itemHeight: 100 } });
    const { visibleItems } = createVirtualizeContent({
      layout,
      viewportEl: makeViewport({ clientWidth: 200, clientHeight: 200 }),
      gap: 10,
      sizing: { mode: "fixed", itemHeight: 100 },
    });

    t.ok("gap>0 時附加 box-sizing 與對半 padding", visibleItems[0].style.includes("box-sizing: border-box; padding: 5px;"));
    t.ok("單欄時第一欄分支優先命中，補上 padding-left:0", visibleItems[0].style.includes("padding-left: 0px;"));
    // 既有邊界情況（非本次修復範圍）：單欄時 column===0 一定先命中 if 分支，
    // else-if 的 padding-right:0 永遠不會被套用，右側因此保留 gap/2 的不對稱留白。
    t.ok("既有 quirk：單欄時右側 padding 不會被歸零", !visibleItems[0].style.includes("padding-right: 0px;"));
  }

  // ── getItemPixelRect ──
  {
    const rect = getItemPixelRect({
      layout: fixedLayout,
      id: "b",
      viewportEl: makeViewport({ clientWidth: 300 }),
      sizing: { mode: "fixed", itemHeight: 56 },
    });
    t.eq("fixed 模式找到項目 b 的像素位置", rect, { top: 56, height: 56 });

    const notFound = getItemPixelRect({ layout: fixedLayout, id: "zzz", viewportEl: makeViewport() });
    t.eq("找不到項目回傳 null", notFound, null);

    const noColumns = getItemPixelRect({ layout: { tracks: [], yMax: 0 }, id: "b", viewportEl: makeViewport() });
    t.eq("欄數為 0 時回傳 null", noColumns, null);

    const zeroWidth = getItemPixelRect({ layout: fixedLayout, id: "b", viewportEl: makeViewport({ clientWidth: 0 }) });
    t.eq("viewportEl 寬度為 0 時回傳 null", zeroWidth, null);

    const narrowRect = getItemPixelRect({
      layout: fixedLayout,
      id: "c",
      viewportEl: makeViewport({ clientWidth: 300 }),
      sizing: { mode: "fixed", itemHeight: 56 },
    });
    const wideRect = getItemPixelRect({
      layout: fixedLayout,
      id: "c",
      viewportEl: makeViewport({ clientWidth: 900 }),
      sizing: { mode: "fixed", itemHeight: 56 },
    });
    t.eq("fixed 模式：scrollToItem 依賴的位置計算不受欄寬影響", narrowRect, wideRect);

    const proportionalRect = getItemPixelRect({
      layout: proportionalLayout,
      id: "c",
      viewportEl: makeViewport({ clientWidth: 300 }),
    });
    t.eq("proportional 模式：欄寬 150（300/2 欄）時 c 的位置為權重 × 欄寬", proportionalRect, { top: 75, height: 300 });
  }
}

export default { name, run };
