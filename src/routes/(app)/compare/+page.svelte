<script lang="ts">
  import { page } from "$app/state";
  import { goto, replaceState } from "$app/navigation";
  import type { PageData } from "./$types";

  import type { ImageQuery } from "$lib/query-spec";
  import { api } from "$lib/utils/request";
  import { addToast } from "$lib/components/floating/toast-events";
  import { requestConfirm } from "$lib/widgets/confirm-events";

  import Toolbar from "./header/Toolbar.svelte";
  import Panel from "./list/Panel.svelte";
  import Cards from "./cards/Cards.svelte";

  let { data }: { data: PageData } = $props();

  /** 是否正在進行處理（取消提交 / 重新整理） */
  let pending = $state(false);
  /** 目前釘選的紀錄 id，原始意圖 */
  let pinnedIds = $derived((page.url.searchParams.get("pinned") ?? "").split(",").filter(Boolean));
  /** id 為鍵的紀錄索引 */
  const recordsById = $derived(new Map(data.items.map((r) => [r.id, r])));
  /** 目前釘選的紀錄 */
  const pinnedRecords = $derived(pinnedIds.map((id) => recordsById.get(id)).filter((r) => r !== undefined));

  /** 不觸發導航的情況下更新 url 中有關 pinned 查詢參數 */
  const updatePinnedSearchParams = () => {
    const params = new URLSearchParams(page.url.searchParams);
    if (pinnedIds.length > 0) params.set("pinned", pinnedIds.join(","));
    else params.delete("pinned");
    const qs = params.toString();
    replaceState(`${page.url.pathname}${qs ? `?${qs}` : ""}`, page.state);
  };

  // ---

  const handleTogglePin = (id: string) => {
    if (pinnedIds.includes(id)) pinnedIds = pinnedIds.filter((x) => x !== id);
    else pinnedIds = [...pinnedIds, id];
    updatePinnedSearchParams();
  };

  const handleUnPin = (id: string) => {
    if (pinnedIds.includes(id)) pinnedIds = pinnedIds.filter((x) => x !== id);
    updatePinnedSearchParams();
  };

  // ---

  const handleQuery = (query: ImageQuery) => {
    const qs = query.toSearchParams(new URLSearchParams(location.search)).toString();
    goto(`${page.url.pathname}${qs ? `?${qs}` : ""}`, { replaceState: true, noScroll: true, keepFocus: true });
  };

  const handleRefresh = async () => {
    if (pending) return;

    pending = true;
    await new Promise((resolve) => setTimeout(resolve, 200)); // debounce

    try {
      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true });
      addToast({ message: "列表已更新", variant: "success" });
    } finally {
      pending = false;
    }
  };

  const handleShuffle = (count: number) => {
    const pool = data.items;
    if (pool.length === 0) {
      addToast({ message: "沒有可抽選的圖片", variant: "error" });
      return;
    }

    const n = Math.min(count, pool.length);
    const indices = new Set<number>();
    while (indices.size < n) indices.add(Math.floor(Math.random() * pool.length));

    pinnedIds = [...indices].map((i) => pool[i].id);
    updatePinnedSearchParams();
  };

  // ---

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

      pinnedIds = pinnedIds.filter((x) => x !== id);
      updatePinnedSearchParams();
      addToast({ message: `已取消提交：${id}`, variant: "info" });

      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true });
    } finally {
      pending = false;
    }
  };
</script>

<svelte:head>
  <title>Compare</title>
</svelte:head>

<div>
  <Toolbar {pending} onquery={handleQuery} onshuffle={handleShuffle} onrefresh={handleRefresh} />
  <Panel items={data.items} total={data.total} {pinnedIds} ontoggle={handleTogglePin}>
    <Cards {pinnedRecords} {pending} onunpin={handleUnPin} onrevert={handleRevert} />
  </Panel>
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
</style>
