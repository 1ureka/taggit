<script lang="ts">
  import { page } from "$app/state";
  import { goto, replaceState, invalidateAll } from "$app/navigation";
  import type { PageData } from "./$types";
  import type { ImageQuery } from "$lib/query-spec";

  import { api } from "$lib/utils/request";
  import { addToast } from "$lib/components/floating/toast-events";
  import { requestConfirm } from "$lib/widgets/confirm-events";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";

  import InverseRadius from "./list/InverseRadius.svelte";
  import Toolbar from "./header/Toolbar.svelte";
  import List from "./list/List.svelte";
  import Cards from "./dock/Cards.svelte";

  let { data }: { data: PageData } = $props();

  /** 是否正在進行處理（取消提交 / 重新整理） */
  let pending = $state(false);

  // ─── 釘選：URL 是唯一真相源（replaceState 讀寫，不重跑 load）───

  const parsePinned = (params: URLSearchParams) => (params.get("pinned") ?? "").split(",").filter(Boolean);

  const pinnedIds = $derived.by(() => {
    // 第一個取值是為了 CSR（shallow routing），第二個取值是為了 SSR 與 load 重跑後的回退
    const state = page.state as { pinned?: string[] };
    return state.pinned ?? parsePinned(page.url.searchParams);
  });

  const setPinned = (ids: string[]) => {
    const params = new URLSearchParams(page.url.searchParams);
    if (ids.length > 0) params.set("pinned", ids.join(","));
    else params.delete("pinned");
    const qs = params.toString();
    replaceState(`${page.url.pathname}${qs ? `?${qs}` : ""}`, { ...page.state, pinned: ids });
  };

  const togglePin = (id: string) => {
    if (pinnedIds.includes(id)) setPinned(pinnedIds.filter((x) => x !== id));
    else setPinned([...pinnedIds, id]);
  };

  // 畫面只讀「能解析到 record 的 ids」：釘選都來自當前列表，load 重跑會依 pinned 參數重新解析
  const recordsById = $derived(new Map(data.items.map((r) => [r.id, r])));
  const pinnedById = $derived(new Map(data.pinnedRecords.map((r) => [r.id, r])));
  const pinnedRecords = $derived(
    pinnedIds.map((id) => pinnedById.get(id) ?? recordsById.get(id)).filter((r) => r !== undefined),
  );

  // ─── 隨機抽選：從當前篩選結果抽 N 張，直接取代全部釘選 ───

  const shuffle = (count: number) => {
    const pool = data.items;
    if (pool.length === 0) {
      addToast({ message: "沒有可抽選的圖片", variant: "error" });
      return;
    }

    const n = Math.min(count, pool.length);
    const indices = new Set<number>();
    while (indices.size < n) indices.add(Math.floor(Math.random() * pool.length));
    setPinned([...indices].map((i) => pool[i].id));
  };

  // ─── 篩選：組出查詢寫回 URL（保留 pinned），load 重跑 ───

  const applyQuery = (query: ImageQuery) => {
    const params = query.toSearchParams(page.url.searchParams);
    if (pinnedIds.length > 0) params.set("pinned", pinnedIds.join(","));
    else params.delete("pinned");
    const qs = params.toString();
    goto(`${page.url.pathname}${qs ? `?${qs}` : ""}`, { replaceState: true, noScroll: true, keepFocus: true });
  };

  // ─── 伺服器操作 ───

  const handleRefresh = async () => {
    if (pending) return;
    pending = true;
    try {
      await new Promise((resolve) => setTimeout(resolve, 200)); // debounce
      await invalidateAll();
      addToast({ message: "列表已更新", variant: "success" });
    } finally {
      pending = false;
    }
  };

  const handleRevert = async (id: string) => {
    if (pending) return;

    const msg = `確定要取消提交 ${id}？\n此操作會刪除圖片的名稱、評等與標籤，圖片本身則回到暫存區。`;
    if (!(await requestConfirm(msg, { title: "取消提交", action: "取消提交" }))) return;

    pending = true;
    try {
      const res = await api.del(`/api/committed/${encodeURIComponent(id)}`);
      if (!res.ok) {
        addToast({ message: "取消提交失敗" + (res.error ? `: ${res.error}` : ""), variant: "error" });
        return;
      }

      setPinned(pinnedIds.filter((x) => x !== id));
      addToast({ message: `已取消提交：${id}`, variant: "info" });

      await invalidateAll();
    } finally {
      pending = false;
    }
  };

  // ─── 左面板開關（與主頁同一套 --left-panel-width 模式，跨頁共用開關狀態）───

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
  <title>Compare</title>
</svelte:head>

<div class="page slide-up">
  <Toolbar {pending} onapply={applyQuery} onshuffle={shuffle} onrefresh={handleRefresh} />

  <div class="body">
    <div class="left-panel-spacer"></div>

    <Cards {pinnedRecords} {pending} onunpin={togglePin} onrevert={handleRevert} />

    <aside class="left-panel">
      <List items={data.items} total={data.total} {pinnedIds} ontoggle={togglePin} />

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
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .body {
    position: relative;
    display: flex;
    align-items: stretch;
    flex: 1;
    min-height: 0;
  }

  /* ─── 左面板（與主頁同一套 spacer + 絕對定位 + CSS 變數模式）─── */

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
