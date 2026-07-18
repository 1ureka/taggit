<script lang="ts">
  import { SvelteMap, SvelteSet } from "svelte/reactivity";
  import { invalidateAll, beforeNavigate, goto } from "$app/navigation";
  import type { PageData } from "./$types";

  import type { Tag } from "$lib/database";
  import { api } from "$lib/utils/request";
  import { formatError } from "$lib/utils/shared";
  import { addToast } from "$lib/components/floating/toast-events";
  import { requestConfirm } from "$lib/widgets/confirm-events";

  import Pool from "./chips/Pool.svelte";
  import Toolbar from "./header/Toolbar.svelte";
  import ZoneContainer from "./zone/ZoneContainer.svelte";
  import ZoneHeader from "./zone/ZoneHeader.svelte";
  import ZoneBodyCreate from "./zone/ZoneBodyCreate.svelte";
  import ZoneBodyGroup from "./zone/ZoneBodyGroup.svelte";
  import ZoneBodyDelete from "./zone/ZoneBodyDelete.svelte";
  import ZoneBodyHidden from "./zone/ZoneBodyHidden.svelte";
  import ReviewModal from "./review/ReviewModal.svelte";

  import { clearPreviews } from "./chips/previews";
  import { submitChangeset } from "./logic/api";
  import { changesetFromBoard, type MergeGroup } from "./logic/changeset";
  import { buildReviewEntries, toggleEntry, toggleAllEntries } from "./review/reviewEntry";

  // ---

  let { data }: { data: PageData } = $props();

  /** 是否正在進行處理 */
  let pending = $state(false);
  /** 審查對話框是否打開 */
  let reviewOpen = $state(false);
  /** 送出後的失敗匯總 */
  let failures = $state<Record<string, string>>({});
  /** 目前刪除區的標籤清單 */
  let deleteList = $state<Tag[]>([]);
  /** 目前切換隱藏區的標籤清單 */
  let hiddenList = $state<Tag[]>([]);
  /** 目前正在拖曳的標籤 */
  let dragging = $state<Tag | null>(null);
  /** 目前拖放的目標區域 */
  let draggingOver = $state<string | null>(null);
  /** 目前有的合併或重命名群組 */
  const groups = new SvelteMap<string, MergeGroup>();
  /** 目前審查清單的勾選標籤名稱 */
  const checkedTags = new SvelteSet<string>();
  /** 目前選擇的標籤 */
  const selectedTags = new SvelteMap<string, Tag>();

  // ---

  /** 每個標籤的狀態查找表 */
  const chipStatus = $derived.by(() => {
    const m = new Map<string, "idle" | "group" | "delete" | "hidden">();
    for (const g of groups.values()) for (const member of g.members) m.set(member.name, "group");
    for (const t of deleteList) m.set(t.name, "delete");
    for (const t of hiddenList) m.set(t.name, "hidden");
    return m;
  });

  /** 目前的審查清單 */
  const reviewEntries = $derived(
    buildReviewEntries(groups.values(), deleteList, hiddenList, checkedTags, failures),
  );

  // ---

  const timers = new Map<string, { timer: ReturnType<typeof setTimeout>; seq: number }>();

  $effect(() => {
    return () => {
      for (const { timer } of timers.values()) clearTimeout(timer);
    };
  });

  /** 查詢合併或重命名後的目標標籤數量預期 */
  const queryMergeCount = (group: MergeGroup) => {
    group.mergeCount = null;

    const prev = timers.get(group.id);
    if (prev) clearTimeout(prev.timer);
    const seq = (prev?.seq ?? 0) + 1;

    const query = async (tags: string[]) => {
      const params = new URLSearchParams({ tags: tags.join(",") });
      const res = await api.get<{ count: number }>(`/api/proto/tags-union-count?${params}`);
      if (!res.ok || !res.data) throw new Error(res.error || "查詢失敗");
      return res.data.count;
    };

    const timer = setTimeout(async () => {
      const tags = [group.canonical.trim(), ...group.members.map((m) => m.name)];
      try {
        const count = await query(tags);
        if (timers.get(group.id)?.seq !== seq) return; // 在途回應已過期
        group.mergeCount = count;
      } catch {
        // 查詢失敗不打擾操作，下次變動再試
      }
    }, 200);

    timers.set(group.id, { timer, seq });
  };

  // ---

  /** 把標籤自所有區域移除 */
  const detachTag = (name: string) => {
    checkedTags.clear();

    for (const group of groups.values()) {
      const exists = group.members.some((m) => m.name === name);
      if (!exists) continue;

      group.members = group.members.filter((m) => m.name !== name);

      if (group.members.length > 0) {
        queryMergeCount(group);
      } else {
        groups.delete(group.id);
      }
    }

    deleteList = deleteList.filter((t) => t.name !== name);
    hiddenList = hiddenList.filter((t) => t.name !== name);
  };

  // ---

  const createGroup = (tags: Tag[]) => {
    if (tags.length === 0) return;

    for (const t of tags) detachTag(t.name);

    const canonical = tags.toSorted((a, b) => b.count - a.count)[0].name;
    const group = $state<MergeGroup>({ id: crypto.randomUUID(), canonical, members: [...tags], mergeCount: null });

    groups.set(group.id, group);
    queryMergeCount(group);
  };

  const addToGroup = (groupId: string, tags: Tag[]) => {
    const group = groups.get(groupId);
    if (!group) return;

    for (const t of tags) {
      if (group.members.some((m) => m.name === t.name)) continue;
      detachTag(t.name);
      group.members.push(t);
    }

    queryMergeCount(group);
  };

  const dissolveGroup = (groupId: string) => {
    checkedTags.clear();
    groups.delete(groupId);
  };

  const addToZone = (zone: "delete" | "hidden", tags: Tag[]) => {
    for (const t of tags) {
      detachTag(t.name);
      if (zone === "delete") deleteList.push(t);
      else hiddenList.push(t);
    }
  };

  const dissolveZone = (zone: "delete" | "hidden") => {
    checkedTags.clear();
    if (zone === "delete") deleteList = [];
    else hiddenList = [];
  };

  // ---

  const handleToggleSelect = (tag: Tag) => {
    if (selectedTags.has(tag.name)) selectedTags.delete(tag.name);
    else selectedTags.set(tag.name, tag);
  };

  const handleClearSelected = () => {
    selectedTags.clear();
  };

  const handleDragStart = (tag: Tag) => {
    dragging = tag;
  };

  const handleDragEnd = () => {
    dragging = null;
    draggingOver = null;
  };

  // ---

  const handleCreateGroup = () => {
    const tags = [...selectedTags.values()];
    selectedTags.clear();
    createGroup(tags);
  };

  const createZoneHandlers = (zone: string) => {
    const ondragover = (e: DragEvent) => {
      e.preventDefault();
      draggingOver = zone;
    };

    const ondragleave = () => {
      if (draggingOver === zone) draggingOver = null;
    };

    const ondrop = (e: DragEvent) => {
      e.preventDefault();
      draggingOver = null;
      if (!dragging) return;

      const tags = selectedTags.has(dragging.name) ? [...selectedTags.values()] : [dragging];
      selectedTags.clear();
      dragging = null;

      if (zone === "new-group") createGroup(tags);
      else if (zone === "delete") addToZone("delete", tags);
      else if (zone === "hidden") addToZone("hidden", tags);
      else if (zone === "pool") for (const t of tags) detachTag(t.name);
      else if (zone.startsWith("group:")) addToGroup(zone.slice(6), tags);
    };

    return { ondragover, ondragleave, ondrop, dropping: zone === draggingOver };
  };

  const createZoneHeaderHandlers = (zone: string) => {
    const group = zone.startsWith("group:") ? groups.get(zone.slice(6)) : undefined;

    const onadd = () => {
      const tags = [...selectedTags.values()];
      selectedTags.clear();

      if (zone === "delete" || zone === "hidden") addToZone(zone, tags);
      else if (group) addToGroup(group.id, tags);
    };

    const ondissolve = () => {
      if (zone === "delete" || zone === "hidden") dissolveZone(zone);
      else if (group) dissolveGroup(group.id);
    };

    let tags: Tag[] = [];
    if (zone === "delete") tags = deleteList;
    else if (zone === "hidden") tags = hiddenList;
    else if (group) tags = group.members;

    return { onadd, ondissolve, tags, selected: selectedTags.size };
  };

  const createZoneBodyHandlers = (zone: string) => {
    const group = zone.startsWith("group:") ? groups.get(zone.slice(6)) : undefined;

    const onremove = (tag: string) => {
      detachTag(tag);
    };

    const onchange = () => {
      if (!group) return;
      checkedTags.clear();
      queryMergeCount(group);
    };

    let tags: Tag[] = [];
    if (zone === "delete") tags = deleteList;
    else if (zone === "hidden") tags = hiddenList;
    else if (group) tags = group.members;

    return { onremove, onchange, tags };
  };

  // ---

  const handleReviewOpen = () => {
    failures = {};
    reviewOpen = true;
  };

  const handleReviewClose = () => {
    if (!pending) reviewOpen = false;
  };

  const handleReviewToggle = (name: string) => {
    toggleEntry(checkedTags, name);
  };

  const handleReviewToggleAll = () => {
    toggleAllEntries(checkedTags, reviewEntries);
  };

  const handleReviewDiscard = (tag: string) => {
    detachTag(tag);
  };

  const handleReviewSubmit = async () => {
    const names = reviewEntries.filter((e) => e.checked).map((e) => e.name);
    if (names.length === 0 || pending) return;

    pending = true;
    try {
      const cs = changesetFromBoard(groups.values(), deleteList, hiddenList);
      const result = await submitChangeset(cs, names);
      failures = Object.fromEntries(result);

      const okNames = names.filter((n) => !result.has(n));
      for (const n of okNames) detachTag(n);

      if (okNames.length > 0) addToast({ message: `已套用 ${okNames.length} 筆標籤操作`, variant: "success" });
      if (result.size > 0) addToast({ message: `${result.size} 筆操作失敗`, variant: "error" });
      if (result.size === 0) reviewOpen = false;

      clearPreviews(); // 標籤內容已變，懸停預覽快取失效
      await invalidateAll();
    } catch (e) {
      addToast({ message: formatError(e), variant: "error" });
    } finally {
      pending = false;
    }
  };

  // ---

  const handleRefresh = async () => {
    if (pending) return;
    pending = true;

    try {
      await new Promise((resolve) => setTimeout(resolve, 200)); // debounce
      await invalidateAll();
      clearPreviews();

      addToast({ message: "標籤列表已更新", variant: "success" });
    } finally {
      pending = false;
    }
  };

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (reviewEntries.length > 0) e.preventDefault();
  };

  beforeNavigate((nav) => {
    if (nav.type === "leave") return;
    if (reviewEntries.length === 0) return;

    nav.cancel();

    const to = nav.to; // 型別收窄
    if (!to) return;

    const msg = `畫布上還有 ${reviewEntries.length} 筆標籤操作尚未送出，離開將會遺失這些排程。確定要離開？`;
    requestConfirm(msg, { title: "尚未送出的標籤操作", action: "離開" }).then((confirmed) => {
      if (!confirmed) return;

      checkedTags.clear();
      groups.clear();
      deleteList = [];
      hiddenList = [];
      goto(to.url.href);
    });
  });
</script>

<svelte:window onbeforeunload={handleBeforeUnload} />

<svelte:head>
  <title>Tags</title>
</svelte:head>

{#snippet aside()}
  <aside>
    <ZoneContainer
      variant="create"
      aria-label="新合併堆"
      {...createZoneHandlers("new-group")}
      style="align-items: center; padding: 1rem 0.75rem;"
    >
      <ZoneBodyCreate selected={selectedTags.size} oncreate={handleCreateGroup} />
    </ZoneContainer>

    {#each groups.values() as group (group.id)}
      <ZoneContainer
        variant="group"
        aria-label={`合併堆 ${group.canonical.trim()}`}
        {...createZoneHandlers(`group:${group.id}`)}
      >
        <ZoneHeader label="合併或重新命名" {...createZoneHeaderHandlers(`group:${group.id}`)} />
        <ZoneBodyGroup
          bind:rename={group.canonical}
          mergeCount={group.mergeCount}
          {...createZoneBodyHandlers(`group:${group.id}`)}
        />
      </ZoneContainer>
    {/each}

    <ZoneContainer variant="delete" aria-label="刪除區" {...createZoneHandlers("delete")}>
      <ZoneHeader label="刪除區" {...createZoneHeaderHandlers("delete")} />
      <ZoneBodyDelete {...createZoneBodyHandlers("delete")} />
    </ZoneContainer>

    <ZoneContainer variant="hidden" aria-label="切換隱藏區" {...createZoneHandlers("hidden")}>
      <ZoneHeader label="切換隱藏區" {...createZoneHeaderHandlers("hidden")} />
      <ZoneBodyHidden {...createZoneBodyHandlers("hidden")} />
    </ZoneContainer>
  </aside>
{/snippet}

<div class="page">
  <Toolbar
    {pending}
    selectedCount={selectedTags.size}
    touchedCount={reviewEntries.length}
    onclear={handleClearSelected}
    onrefresh={handleRefresh}
    onreview={handleReviewOpen}
  />

  <div>
    <Pool
      items={data.items}
      total={data.total}
      status={chipStatus}
      selected={new Set(selectedTags.keys())}
      ontoggle={handleToggleSelect}
      ondragstart={handleDragStart}
      ondragend={handleDragEnd}
      {...createZoneHandlers("pool")}
    />
    {@render aside()}
  </div>
</div>

<ReviewModal
  open={reviewOpen}
  entries={reviewEntries}
  checkedCount={checkedTags.size}
  readyCount={reviewEntries.filter((e) => e.checkable).length}
  {pending}
  onclose={handleReviewClose}
  onsubmit={handleReviewSubmit}
  ontoggle={handleReviewToggle}
  ontoggleall={handleReviewToggleAll}
  ondiscard={handleReviewDiscard}
/>

<style>
  div.page {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  div.page > div {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  aside {
    width: 23rem;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    min-height: 0;
    overflow-y: auto;
    padding: 0.75rem;
    border-left: var(--border-style);
    background: var(--color-bg-card);

    @media (max-width: 600px) {
      width: 16rem;
    }
  }
</style>
