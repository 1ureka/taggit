<script lang="ts">
  import type { Snippet } from "svelte";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import InverseRadius from "$lib/widgets/InverseRadius.svelte";
  import List from "./List.svelte";

  type Props = {
    /** 面板右側外部的內容 */
    children: Snippet;
  };

  let { children }: Props = $props();

  let collapsed = $state(false);

  // 只在掛載當下依目前視窗寬度決定初始收合狀態，不監聽 resize（刻意行為）
  $effect(() => {
    if (window.innerWidth < 600) collapsed = true;
  });

  // --left-panel-width 是跨路由共用的全域 CSS 變數，卸載時必須清掉，否則收合狀態會滲漏給之後掛載的其他頁面
  $effect(() => {
    const root = document.documentElement;
    if (collapsed) root.style.setProperty("--left-panel-width", "0px");
    else root.style.removeProperty("--left-panel-width");
    return () => root.style.removeProperty("--left-panel-width");
  });

  const handleTogglePanel = () => {
    collapsed = !collapsed;
  };
</script>

<div>
  <div class="spacer"></div>

  {@render children()}

  <aside>
    <List />

    <button
      type="button"
      aria-label="開合圖庫列表"
      {@attach tooltip({ content: "開合圖庫列表", placement: "right" })}
      onclick={handleTogglePanel}
    >
      <InverseRadius corner="bottom-left" size="16px" />
    </button>
  </aside>
</div>

<style>
  div:has(> .spacer) {
    position: relative;
    display: flex;
    align-items: stretch;
    flex: 1;
    min-height: 0;
  }

  div.spacer {
    width: var(--left-panel-width, 280px);
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    @media (max-width: 600px) {
      width: 0px;
    }
  }

  aside {
    position: absolute;
    top: 0;
    bottom: 0;
    overflow: visible;
    background: var(--color-bg-card);
    border-right: var(--border-style);
    width: 280px;
    transform: translateX(calc(-100% + var(--left-panel-width, 280px)));
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    @media (max-width: 600px) {
      width: calc(100% - 32px);
      transform: translateX(calc(-100% + var(--left-panel-width, 100%)));
    }
  }

  aside > button {
    position: absolute;
    overflow: visible;
    top: 0;
    left: 100%;
    width: 32px;
    height: 100px;
    background-color: var(--color-bg-card);
    border-bottom-right-radius: 16px;
    border: var(--border-style);
    border-top: 0px;
    border-left: 0px;

    display: grid;
    place-items: center;

    &::after {
      content: "";
      display: block;
      width: 20%;
      height: 60%;
      background: var(--color-border);
      border-radius: 999px;
      transition:
        background 0.15s,
        transform 0.15s;
    }

    &:hover::after {
      background: var(--color-border-hover);
      scale: 1.05;
    }

    &:active::after {
      scale: 0.95;
    }
  }
</style>
