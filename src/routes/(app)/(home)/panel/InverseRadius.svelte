<!--
  @component
  建立反向（凹面）圓角效果，用於視覺上將本元素「黏合」到相鄰元素，
  使兩者交界處產生平滑的凹面過渡，而非生硬的直角。

  - `corner` — 本元素的哪個角落需要黏合效果
  - `direction` — 相鄰元素的方位：`"horizontal"` 表示相鄰元素在左側或右側，`"vertical"` 表示在上方或下方

  例如:
  - `corner="bottom-left" direction="horizontal"` 表示本元素的左下角黏合到左側的相鄰元素。
  - `corner="top-right" direction="horizontal"` 表示本元素的右上角黏合到右側的相鄰元素。
  - `corner="top-right" direction="vertical"` 表示本元素的右上角黏合到上方的相鄰元素。

  **注意事項：**
  - 本元素（或定位祖先）必須設定 `overflow: visible`，否則凹面圓角會被裁切
-->
<script lang="ts">
  type Props = {
    /** 本元素上需要黏合效果的角落 */
    corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    /** 相鄰元素的方位：horizontal 為左右相鄰，vertical 為上下相鄰 */
    direction?: "horizontal" | "vertical";
    /** 凹面圓角的尺寸 */
    size?: string;
    /** 凹面露出的底色 */
    bg?: string;
    /** 與本元素一致的表面顏色 */
    surface?: string;
    /** 邊框樣式，完整 shorthand */
    border?: string;
  };

  let {
    corner,
    direction = "horizontal",
    size = "16px",
    bg = "var(--color-bg)",
    surface = "var(--color-bg-card)",
    border = "var(--border-style)",
  }: Props = $props();
</script>

<div
  class="inverse-radius"
  class:tl={corner === "top-left"}
  class:tr={corner === "top-right"}
  class:bl={corner === "bottom-left"}
  class:br={corner === "bottom-right"}
  class:h={direction === "horizontal"}
  class:v={direction === "vertical"}
  style="--_size:{size}; --_bg:{bg}; --_surface:{surface}; --_border:{border}"
></div>

<style>
  .inverse-radius {
    position: absolute;
    width: var(--_size);
    height: var(--_size);
    background-color: var(--_surface);
    pointer-events: none;

    &::after {
      content: "";
      position: absolute;
      inset: 0;
      background-color: var(--_bg);
    }
  }

  /* horizontal: 相鄰元素在左右，元件向上下延伸 */

  .tl.h {
    bottom: 100%;
    left: 0;

    &::after {
      border-bottom-left-radius: var(--_size);
      border-bottom: var(--_border);
      border-left: var(--_border);
    }
  }

  .tr.h {
    bottom: 100%;
    right: 0;

    &::after {
      border-bottom-right-radius: var(--_size);
      border-bottom: var(--_border);
      border-right: var(--_border);
    }
  }

  .bl.h {
    top: 100%;
    left: 0;

    &::after {
      border-top-left-radius: var(--_size);
      border-top: var(--_border);
      border-left: var(--_border);
    }
  }

  .br.h {
    top: 100%;
    right: 0;

    &::after {
      border-top-right-radius: var(--_size);
      border-top: var(--_border);
      border-right: var(--_border);
    }
  }

  /* vertical: 相鄰元素在上下，元件向左右延伸 */

  .tl.v {
    top: 0;
    right: 100%;

    &::after {
      border-top-right-radius: var(--_size);
      border-top: var(--_border);
      border-right: var(--_border);
    }
  }

  .tr.v {
    top: 0;
    left: 100%;

    &::after {
      border-top-left-radius: var(--_size);
      border-top: var(--_border);
      border-left: var(--_border);
    }
  }

  .bl.v {
    bottom: 0;
    right: 100%;

    &::after {
      border-bottom-right-radius: var(--_size);
      border-bottom: var(--_border);
      border-right: var(--_border);
    }
  }

  .br.v {
    bottom: 0;
    left: 100%;

    &::after {
      border-bottom-left-radius: var(--_size);
      border-bottom: var(--_border);
      border-left: var(--_border);
    }
  }
</style>
