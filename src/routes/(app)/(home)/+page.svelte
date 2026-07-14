<script lang="ts">
  import { navigating, page } from "$app/state";
  import { replaceState } from "$app/navigation";
  import { innerWidth } from "svelte/reactivity/window";
  import type { PageData } from "./$types";

  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { breakpoints } from "./wall/config";
  import MasonryWall from "./wall/MasonryWall.svelte";
  import ExplorePanel from "./panel/ExplorePanel.svelte";
  import InverseRadius from "./panel/InverseRadius.svelte";
  import DetailModal from "./detail/DetailModal.svelte";

  let { data }: { data: PageData } = $props();

  const layout = $derived.by(() => {
    const width = innerWidth.current ?? 1000;
    return breakpoints.find((b) => width >= b.width)!;
  });

  let columns = $derived(layout.cols);

  // ---

  const record = $derived.by(() => {
    const state = page.state as { modal?: string; modalClose?: boolean };
    if (state.modalClose) return null;

    // 第一個取值是為了 SSR，第二個取值是為了 CSR（shallow routing）
    const id = state.modal || page.url.searchParams.get("modal");
    if (!id) return null;

    return data.items.find((item) => item.id === id) ?? null;
  });

  /** 前往 editor 的連結，帶上當下的篩選參數，使 editor 的統一查詢與 home 一致，隱藏標籤圖片才不會在 editor 被再次遮蔽 */
  const recordHref = $derived.by(() => {
    if (!record) return "/editor";

    const params = new URLSearchParams(page.url.searchParams);
    params.delete("modal");
    params.set("currentId", record.id);
    return `/editor?${params.toString()}`;
  });

  // ---

  const handleSelect = (id: string) => {
    const params = new URLSearchParams(page.url.searchParams);
    params.set("modal", id);
    replaceState(`/?${params.toString()}`, { modal: id, modalClose: false });
  };

  const handleModalClose = () => {
    if (!record) return; // 確保真的有打開，才允許關閉
    const params = new URLSearchParams(page.url.searchParams);
    params.delete("modal");
    replaceState(`/?${params.toString()}`, { modalClose: true });
  };

  // ---

  $effect(() => {
    if (window.innerWidth < 600) {
      document.documentElement.style.setProperty("--left-panel-width", "0px");
    }
  });

  const handleTogglePanel = () => {
    const root = document.documentElement;
    const property = getComputedStyle(root).getPropertyValue("--left-panel-width");

    if (!property.trim()) {
      root.style.setProperty("--left-panel-width", "0px");
    } else {
      root.style.removeProperty("--left-panel-width");
    }
  };
</script>

<svelte:head>
  <title>Taggit</title>
</svelte:head>

<main class="slide-up">
  <div class="left-panel-spacer"></div>

  <MasonryWall
    items={data.items}
    {columns}
    paddingX={layout.p}
    paddingY={layout.p}
    gap={layout.g}
    empty={data.total === 0 && !navigating.to}
    onselect={handleSelect}
  />

  <aside class="left-panel">
    <ExplorePanel total={data.total} bind:columns />

    <button
      type="button"
      aria-label="開合探索面板"
      {@attach tooltip({ content: "開合探索面板", placement: "right" })}
      onclick={handleTogglePanel}
    >
      <InverseRadius corner="bottom-left" size="16px" />
    </button>
  </aside>
</main>

<DetailModal {record} editorHref={recordHref} onclose={handleModalClose} />

<style>
  main {
    position: relative;
    display: flex;
    align-items: stretch;
    flex: 1;
    min-height: 0;
  }

  div.left-panel-spacer {
    width: var(--left-panel-width, 280px);
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    @media (max-width: 600px) {
      width: 0px;
    }
  }

  aside.left-panel {
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

  aside.left-panel > button {
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
  }

  aside.left-panel > button {
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
