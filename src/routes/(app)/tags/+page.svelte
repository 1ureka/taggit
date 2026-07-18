<script lang="ts">
  import { SvelteMap, SvelteSet } from "svelte/reactivity";
  import { invalidateAll, beforeNavigate, goto } from "$app/navigation";
  import type { PageData } from "./$types";

  import type { Tag } from "$lib/database";
  import { type ChangesetPreview } from "$lib/query-spec";
  import { formatError } from "$lib/utils/shared";
  import { addToast } from "$lib/components/floating/toast-events";
  import { requestConfirm } from "$lib/widgets/confirm-events";

  import Pool from "./chips/Pool.svelte";
  import { clearPreviews } from "./chips/previews";
  import ZoneContainer from "./zone/ZoneContainer.svelte";
  import ZoneHeader from "./zone/ZoneHeader.svelte";
  import ZoneBodyCreate from "./zone/ZoneBodyCreate.svelte";
  import ZoneBodyGroup from "./zone/ZoneBodyGroup.svelte";
  import ZoneBodyDelete from "./zone/ZoneBodyDelete.svelte";
  import ZoneBodyHidden from "./zone/ZoneBodyHidden.svelte";
  import ReviewModal from "./review/ReviewModal.svelte";

  import { fetchProjection, submitChangeset } from "./logic/api";
  import { changesetFromBoard, changesetSize, type MergeGroup } from "./logic/changeset";
  import { buildReviewEntries, toggleEntry, toggleAllEntries } from "./review/reviewEntry";
  import Toolbar from "./header/Toolbar.svelte";

  // ---

  let { data }: { data: PageData } = $props();

  /** 是否正在進行處理（送出 / 重新整理） */
  let pending = $state(false);
  /** 審查對話框是否打開 */
  let reviewOpen = $state(false);
  /** 送出後的失敗匯總（key -> 錯誤訊息） */
  let failures = $state<Record<string, string>>({});
  /** 目前審查清單的勾選 keys，使用者的原始意圖，不主動清除 */
  const checkedKeys = new SvelteSet<string>();

  // ─── 畫布狀態（畫布即變更集的空間化呈現；標籤直接以 Tag 存放，送出前才轉成變更集）───

  let groups = $state<MergeGroup[]>([]);
  let deleteList = $state<Tag[]>([]);
  let toggleList = $state<Tag[]>([]);
  let groupSeq = 1;

  const changeset = $derived(changesetFromBoard(groups, deleteList, toggleList));
  const pendingCount = $derived(changesetSize(changeset));

  type ChipStatus = "idle" | "group" | "delete" | "hidden";

  /** chip 池呈現用的狀態查找表（同一標籤同時只會在畫布上的一個位置） */
  const status = $derived.by(() => {
    const m = new Map<string, ChipStatus>();
    for (const g of groups) for (const member of g.members) m.set(member.name, "group");
    for (const t of deleteList) m.set(t.name, "delete");
    for (const t of toggleList) m.set(t.name, "hidden");
    return m;
  });

  /** 畫布上每個標籤目前的 Tag（審查條目的 count 後備值） */
  const tagByName = $derived.by(() => {
    const m = new Map<string, Tag>();
    for (const g of groups) for (const member of g.members) m.set(member.name, member);
    for (const t of deleteList) m.set(t.name, t);
    for (const t of toggleList) m.set(t.name, t);
    return m;
  });

  /** 先把標籤自畫布所有位置移除（換位置前的共用動作） */
  const detachFromBoard = (name: string) => {
    for (const g of groups) g.members = g.members.filter((m) => m.name !== name);
    groups = groups.filter((g) => g.members.length > 0);
    deleteList = deleteList.filter((t) => t.name !== name);
    toggleList = toggleList.filter((t) => t.name !== name);
    schedulePreview();
  };

  const createGroup = (tags: Tag[]) => {
    if (tags.length === 0) return;
    for (const t of tags) detachFromBoard(t.name);
    // 代表名預設取使用數最高的成員
    const canonical = tags.toSorted((a, b) => b.count - a.count)[0].name;
    groups.push({ id: groupSeq++, canonical, members: [...tags] });
    schedulePreview();
  };

  const addToGroup = (groupId: number, tags: Tag[]) => {
    for (const t of tags) {
      detachFromBoard(t.name);
      const g = groups.find((x) => x.id === groupId);
      if (!g) break; // 目標堆因 detach 清空而消失
      if (!g.members.some((m) => m.name === t.name)) g.members.push(t);
    }
    schedulePreview();
  };

  const addToZone = (zone: "delete" | "toggle", tags: Tag[]) => {
    for (const t of tags) {
      detachFromBoard(t.name);
      if (zone === "delete") deleteList.push(t);
      else toggleList.push(t);
    }
    schedulePreview();
  };

  const dissolveGroup = (groupId: number) => {
    groups = groups.filter((g) => g.id !== groupId);
    schedulePreview();
  };

  const clearDeleteList = () => {
    deleteList = [];
    schedulePreview();
  };

  const clearToggleList = () => {
    toggleList = [];
    schedulePreview();
  };

  const setCanonical = (groupId: number, name: string) => {
    const g = groups.find((x) => x.id === groupId);
    if (g) g.canonical = name;
    schedulePreview();
  };

  /** 審查 modal 的捨棄 → 映射回畫布操作 */
  const discardBoardKey = (key: string) => {
    const sep = key.indexOf(":");
    const kind = key.slice(0, sep);
    const name = key.slice(sep + 1);
    if (kind === "rename" || kind === "delete") detachFromBoard(name);
    else if (kind === "hidden") toggleList = toggleList.filter((t) => t.name !== name);
    checkedKeys.delete(key);
  };

  // ─── 選取（點擊備援，不用拖也能操作；快照在選取當下捕捉）───

  const selected = new SvelteMap<string, Tag>();
  const selectedNames = $derived(new Set(selected.keys()));

  const toggleSelect = (tag: Tag) => {
    if (selected.has(tag.name)) selected.delete(tag.name);
    else selected.set(tag.name, tag);
  };

  const takeSelection = (): Tag[] => {
    const tags = [...selected.values()];
    selected.clear();
    return tags;
  };

  const clearSelection = () => {
    selected.clear();
  };

  // ─── 拖放（拖曳狀態純前端；拖入的那顆若在選取集合內，整批一起帶過去）───

  let dragging = $state<Tag | null>(null);
  let dragOverZone = $state<string | null>(null);

  const handleDragStart = (tag: Tag) => {
    dragging = tag;
  };

  const handleDragEnd = () => {
    dragging = null;
    dragOverZone = null;
  };

  const allowDrop = (e: DragEvent, zone: string) => {
    e.preventDefault();
    dragOverZone = zone;
  };

  const leaveDropZone = (zone: string) => {
    if (dragOverZone === zone) dragOverZone = null;
  };

  const handleDrop = (e: DragEvent, target: string) => {
    e.preventDefault();
    dragOverZone = null;
    if (!dragging) return;

    const tags = selected.has(dragging.name) ? [...selected.values()] : [dragging];
    selected.clear();
    dragging = null;

    if (target === "new-group") createGroup(tags);
    else if (target === "delete") addToZone("delete", tags);
    else if (target === "toggle") addToZone("toggle", tags);
    else if (target === "pool") for (const t of tags) detachFromBoard(t.name);
    else if (target.startsWith("group:")) addToGroup(Number(target.slice(6)), tags);
  };

  // ─── 變更集預估：畫布變動去抖後查 tags-preview，審查 modal 開啟時再查一次 ───

  let projection = $state<ChangesetPreview | null>(null);
  let projectionPending = $state(false);
  let previewSeq = 0;
  let previewTimer: ReturnType<typeof setTimeout>;

  $effect(() => {
    return () => clearTimeout(previewTimer);
  });

  const runPreview = async () => {
    const seq = ++previewSeq;
    const cs = changeset;

    if (changesetSize(cs) === 0) {
      projection = null;
      projectionPending = false;
      return;
    }

    projectionPending = true;
    try {
      const result = await fetchProjection(cs);
      if (seq !== previewSeq) return;
      projection = result;
    } catch {
      // 預估失敗不打擾操作：保留上一版數字，下次變動再試；真正的把關在送出時
    } finally {
      if (seq === previewSeq) projectionPending = false;
    }
  };

  const schedulePreview = () => {
    previewSeq++; // 遞增序號讓在途回應立即失效
    clearTimeout(previewTimer);
    previewTimer = setTimeout(runPreview, 300);
  };

  // ─── 審查與送出 ───

  const reviewEntries = $derived(
    buildReviewEntries(changeset, (name) => tagByName.get(name), projection, checkedKeys, failures),
  );

  const handleReviewOpen = () => {
    failures = {};
    clearTimeout(previewTimer);
    runPreview(); // 開啟當下立即取最新預估
    reviewOpen = true;
  };

  const handleReviewClose = () => {
    if (!pending) reviewOpen = false;
  };

  const handleReviewToggle = (key: string) => {
    toggleEntry(checkedKeys, key);
  };

  const handleReviewToggleAll = () => {
    toggleAllEntries(checkedKeys, reviewEntries);
  };

  const handleSubmit = async () => {
    const keys = reviewEntries.filter((e) => e.checked).map((e) => e.key);
    if (keys.length === 0 || pending) return;

    pending = true;
    try {
      const result = await submitChangeset(changeset, keys);
      failures = Object.fromEntries(result);

      const okKeys = keys.filter((k) => !result.has(k));
      for (const k of okKeys) discardBoardKey(k);

      if (okKeys.length > 0) addToast({ message: `已套用 ${okKeys.length} 筆標籤操作`, variant: "success" });
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

  // ─── 重新整理 ───

  const handleRefresh = async () => {
    if (pending) return;
    pending = true;
    try {
      await new Promise((resolve) => setTimeout(resolve, 200)); // debounce
      clearPreviews();
      await invalidateAll();
      addToast({ message: "標籤列表已更新", variant: "success" });
    } finally {
      pending = false;
    }
  };

  // ─── 離開防護 ───

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (pendingCount > 0) e.preventDefault();
  };

  beforeNavigate((nav) => {
    if (nav.type === "leave") return;
    if (pendingCount === 0) return;

    nav.cancel();

    const to = nav.to; // 型別收窄
    if (!to) return;

    const msg = `畫布上還有 ${pendingCount} 筆標籤操作尚未送出，離開將會遺失這些排程。確定要離開？`;
    requestConfirm(msg, { title: "尚未送出的標籤操作", action: "離開" }).then((confirmed) => {
      if (!confirmed) return;

      groups = [];
      deleteList = [];
      toggleList = [];
      goto(to.url.href);
    });
  });
</script>

<svelte:window onbeforeunload={handleBeforeUnload} />

<svelte:head>
  <title>Tags</title>
</svelte:head>

<div class="page">
  <Toolbar
    {pending}
    selectedCount={selected.size}
    touchedCount={pendingCount}
    onclear={clearSelection}
    onrefresh={handleRefresh}
    onreview={handleReviewOpen}
  />

  <div class="body">
    <Pool
      items={data.items}
      total={data.total}
      {status}
      selected={selectedNames}
      dropping={dragOverZone === "pool"}
      ontoggle={toggleSelect}
      ondragstart={handleDragStart}
      ondragend={handleDragEnd}
      ondragover={(e) => allowDrop(e, "pool")}
      ondragleave={() => leaveDropZone("pool")}
      ondrop={(e) => handleDrop(e, "pool")}
    />

    <aside class="board">
      <ZoneContainer
        variant="create"
        aria-label="新合併堆"
        dropping={dragOverZone === "new-group"}
        ondragover={(e) => allowDrop(e, "new-group")}
        ondragleave={() => leaveDropZone("new-group")}
        ondrop={(e) => handleDrop(e, "new-group")}
        style="align-items: center; padding: 1rem 0.75rem;"
      >
        <ZoneBodyCreate selected={selected.size} oncreate={() => createGroup(takeSelection())} />
      </ZoneContainer>

      {#each groups as group (group.id)}
        <ZoneContainer
          variant="group"
          aria-label={`合併堆 ${group.canonical.trim()}`}
          dropping={dragOverZone === `group:${group.id}`}
          ondragover={(e) => allowDrop(e, `group:${group.id}`)}
          ondragleave={() => leaveDropZone(`group:${group.id}`)}
          ondrop={(e) => handleDrop(e, `group:${group.id}`)}
        >
          <ZoneHeader
            selected={selected.size}
            label="合併或重新命名"
            tags={group.members.map((m) => m.name)}
            onadd={() => addToGroup(group.id, takeSelection())}
            ondissolve={() => dissolveGroup(group.id)}
          />
          <ZoneBodyGroup
            tags={group.members}
            bind:rename={group.canonical}
            count={projection?.mergedCounts[group.canonical.trim()]}
            onactive={(name) => setCanonical(group.id, name)}
            onremove={(name) => detachFromBoard(name)}
            onrename={schedulePreview}
          />
        </ZoneContainer>
      {/each}

      <ZoneContainer
        variant="delete"
        aria-label="刪除區"
        dropping={dragOverZone === "delete"}
        ondragover={(e) => allowDrop(e, "delete")}
        ondragleave={() => leaveDropZone("delete")}
        ondrop={(e) => handleDrop(e, "delete")}
      >
        <ZoneHeader
          selected={selected.size}
          label="刪除區"
          tags={deleteList.map((t) => t.name)}
          onadd={() => addToZone("delete", takeSelection())}
          ondissolve={clearDeleteList}
        />
        <ZoneBodyDelete tags={deleteList} onremove={(name) => detachFromBoard(name)} />
      </ZoneContainer>

      <ZoneContainer
        variant="hidden"
        aria-label="切換隱藏區"
        dropping={dragOverZone === "toggle"}
        ondragover={(e) => allowDrop(e, "toggle")}
        ondragleave={() => leaveDropZone("toggle")}
        ondrop={(e) => handleDrop(e, "toggle")}
      >
        <ZoneHeader
          selected={selected.size}
          label="切換隱藏區"
          tags={toggleList.map((t) => t.name)}
          onadd={() => addToZone("toggle", takeSelection())}
          ondissolve={clearToggleList}
        />
        <ZoneBodyHidden tags={toggleList} onremove={(name) => detachFromBoard(name)} />
      </ZoneContainer>
    </aside>
  </div>
</div>

<ReviewModal
  open={reviewOpen}
  entries={reviewEntries}
  {pending}
  previewPending={projectionPending}
  onclose={handleReviewClose}
  onsubmit={handleSubmit}
  ontoggle={handleReviewToggle}
  ontoggleall={handleReviewToggleAll}
  ondiscard={discardBoardKey}
/>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  /* ─── 主體 ─── */

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  /* ─── 右側畫布 ─── */

  .board {
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
