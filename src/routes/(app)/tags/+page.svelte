<script lang="ts">
  import { SvelteMap, SvelteSet } from "svelte/reactivity";
  import { invalidateAll, beforeNavigate, goto } from "$app/navigation";
  import type { PageData } from "./$types";

  import { ImageWhere, type ChangesetPreview } from "$lib/query-spec";
  import { formatError } from "$lib/utils/shared";
  import { addToast } from "$lib/components/floating/toast-events";
  import { requestConfirm } from "$lib/widgets/confirm-events";

  import Button from "$lib/components/actions/Button.svelte";

  import TagPool from "./pool/TagPool.svelte";
  import { clearPreviews } from "./pool/previews";
  import MergeGroupCard from "./board/MergeGroup.svelte";
  import Zone from "./board/Zone.svelte";
  import ReviewModal from "./review/ReviewModal.svelte";

  import { fetchProjection, submitChangeset } from "./logic/api";
  import {
    changesetFromBoard,
    changesetSize,
    changesetEntries,
    type TagSnapshot,
    type MergeGroup,
  } from "./logic/changeset";
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

  // ─── 畫布狀態（畫布即變更集的空間化呈現；標籤攜帶放入當下的快照）───

  let groups = $state<MergeGroup[]>([]);
  let deleteList = $state<TagSnapshot[]>([]);
  let toggleList = $state<TagSnapshot[]>([]);
  let groupSeq = 1;

  const changeset = $derived(changesetFromBoard(groups, deleteList, toggleList));
  const pendingCount = $derived(changesetSize(changeset));

  /** 每個標籤目前被擺在哪裡（每個標籤同時只能在一個位置） */
  const placement = $derived.by(() => {
    const m = new Map<string, string>();
    for (const g of groups) for (const member of g.members) m.set(member.name, `group:${g.id}`);
    for (const s of deleteList) m.set(s.name, "delete");
    for (const s of toggleList) m.set(s.name, "toggle");
    return m;
  });

  /** 畫布上每個標籤的快照（審查條目的 count 後備值） */
  const snapshotByName = $derived.by(() => {
    const m = new Map<string, TagSnapshot>();
    for (const g of groups) for (const member of g.members) m.set(member.name, member);
    for (const s of deleteList) m.set(s.name, s);
    for (const s of toggleList) m.set(s.name, s);
    return m;
  });

  /** 先把標籤自畫布所有位置移除（換位置前的共用動作） */
  const detachFromBoard = (name: string) => {
    for (const g of groups) g.members = g.members.filter((m) => m.name !== name);
    groups = groups.filter((g) => g.members.length > 0);
    deleteList = deleteList.filter((s) => s.name !== name);
    toggleList = toggleList.filter((s) => s.name !== name);
    schedulePreview();
  };

  const createGroup = (snaps: TagSnapshot[]) => {
    if (snaps.length === 0) return;
    for (const s of snaps) detachFromBoard(s.name);
    // 代表名預設取使用數最高的成員
    const canonical = snaps.toSorted((a, b) => b.count - a.count)[0].name;
    groups.push({ id: groupSeq++, canonical, members: [...snaps] });
    schedulePreview();
  };

  const addToGroup = (groupId: number, snaps: TagSnapshot[]) => {
    for (const s of snaps) {
      detachFromBoard(s.name);
      const g = groups.find((x) => x.id === groupId);
      if (!g) break; // 目標堆因 detach 清空而消失
      if (!g.members.some((m) => m.name === s.name)) g.members.push(s);
    }
    schedulePreview();
  };

  const addToZone = (zone: "delete" | "toggle", snaps: TagSnapshot[]) => {
    for (const s of snaps) {
      detachFromBoard(s.name);
      if (zone === "delete") deleteList.push(s);
      else toggleList.push(s);
    }
    schedulePreview();
  };

  const dissolveGroup = (groupId: number) => {
    groups = groups.filter((g) => g.id !== groupId);
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
    else if (kind === "hidden") toggleList = toggleList.filter((s) => s.name !== name);
    checkedKeys.delete(key);
  };

  // ─── 選取（點擊備援，不用拖也能操作；快照在選取當下捕捉）───

  const selected = new SvelteMap<string, TagSnapshot>();
  const selectedNames = $derived(new Set(selected.keys()));

  const toggleSelect = (snap: TagSnapshot) => {
    if (selected.has(snap.name)) selected.delete(snap.name);
    else selected.set(snap.name, snap);
  };

  const takeSelection = (): TagSnapshot[] => {
    const snaps = [...selected.values()];
    selected.clear();
    return snaps;
  };

  const clearSelection = () => {
    selected.clear();
  };

  // ─── 拖放（拖曳狀態純前端；拖入的那顆若在選取集合內，整批一起帶過去）───

  let dragging = $state<TagSnapshot | null>(null);
  let dragOverZone = $state<string | null>(null);

  const handleDragStart = (snap: TagSnapshot) => {
    dragging = snap;
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

    const snaps = selected.has(dragging.name) ? [...selected.values()] : [dragging];
    selected.clear();
    dragging = null;

    if (target === "new-group") createGroup(snaps);
    else if (target === "delete") addToZone("delete", snaps);
    else if (target === "toggle") addToZone("toggle", snaps);
    else if (target === "pool") for (const s of snaps) detachFromBoard(s.name);
    else if (target.startsWith("group:")) addToGroup(Number(target.slice(6)), snaps);
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

  const reviewEntries = $derived.by(() => {
    const base = changesetEntries(changeset, (name) => snapshotByName.get(name), projection);
    return base.map((e) => ({
      ...e,
      checked: checkedKeys.has(e.key) && e.problem === null,
      failure: failures[e.key],
    }));
  });

  const handleReviewOpen = () => {
    failures = {};
    checkedKeys.clear();
    for (const e of changesetEntries(changeset, (name) => snapshotByName.get(name), projection)) {
      if (e.problem === null) checkedKeys.add(e.key);
    }
    clearTimeout(previewTimer);
    runPreview(); // 開啟當下立即取最新預估
    reviewOpen = true;
  };

  const handleReviewClose = () => {
    if (!pending) reviewOpen = false;
  };

  const handleReviewToggle = (key: string) => {
    if (checkedKeys.has(key)) checkedKeys.delete(key);
    else checkedKeys.add(key);
  };

  const handleReviewToggleAll = () => {
    const checkable = reviewEntries.filter((e) => e.problem === null);
    if (checkable.every((e) => e.checked)) checkedKeys.clear();
    else for (const e of checkable) checkedKeys.add(e.key);
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

  // ─── 導航輔助 ───

  /** 以指定標籤 AND 查詢回主頁的連結（hidden 標籤因 includedTags 豁免不會被遮蔽） */
  const externalHref = (names: string[]) => `/?${new ImageWhere({ includedTags: names }).toSearchParams()}`;

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
    <TagPool
      items={data.items}
      total={data.total}
      {placement}
      {selectedNames}
      dropping={dragOverZone === "pool"}
      ontoggleselect={toggleSelect}
      ondragstart={handleDragStart}
      ondragend={handleDragEnd}
      onpooldragover={(e) => allowDrop(e, "pool")}
      onpooldragleave={() => leaveDropZone("pool")}
      onpooldrop={(e) => handleDrop(e, "pool")}
    />

    <aside class="board">
      <div
        class="new-group"
        class:dropping={dragOverZone === "new-group"}
        role="group"
        aria-label="新合併堆"
        ondragover={(e) => allowDrop(e, "new-group")}
        ondragleave={() => leaveDropZone("new-group")}
        ondrop={(e) => handleDrop(e, "new-group")}
      >
        <p>拖曳到這裡建立<b>合併堆</b></p>
        <Button
          variant="outlined"
          status={selected.size === 0 ? "disabled" : undefined}
          onclick={() => createGroup(takeSelection())}
        >
          把選取的 {selected.size} 個變成一堆
        </Button>
      </div>

      {#each groups as group (group.id)}
        <MergeGroupCard
          {group}
          mergedCount={projection?.mergedCounts[group.canonical.trim()]}
          previewPending={projectionPending}
          dropping={dragOverZone === `group:${group.id}`}
          selectedCount={selected.size}
          externalHref={externalHref(group.members.map((m) => m.name))}
          ondragover={(e) => allowDrop(e, `group:${group.id}`)}
          ondragleave={() => leaveDropZone(`group:${group.id}`)}
          ondrop={(e) => handleDrop(e, `group:${group.id}`)}
          onaddselected={() => addToGroup(group.id, takeSelection())}
          ondissolve={() => dissolveGroup(group.id)}
          onsetcanonical={(name) => setCanonical(group.id, name)}
          onremovemember={(name) => detachFromBoard(name)}
          oncanonicalinput={schedulePreview}
        />
      {/each}

      <Zone
        kind="delete"
        items={deleteList}
        dropping={dragOverZone === "delete"}
        selectedCount={selected.size}
        externalHref={externalHref(deleteList.map((s) => s.name))}
        ondragover={(e) => allowDrop(e, "delete")}
        ondragleave={() => leaveDropZone("delete")}
        ondrop={(e) => handleDrop(e, "delete")}
        onaddselected={() => addToZone("delete", takeSelection())}
        onremove={(name) => detachFromBoard(name)}
      />

      <Zone
        kind="toggle"
        items={toggleList}
        dropping={dragOverZone === "toggle"}
        selectedCount={selected.size}
        externalHref={externalHref(toggleList.map((s) => s.name))}
        ondragover={(e) => allowDrop(e, "toggle")}
        ondragleave={() => leaveDropZone("toggle")}
        ondrop={(e) => handleDrop(e, "toggle")}
        onaddselected={() => addToZone("toggle", takeSelection())}
        onremove={(name) => detachFromBoard(name)}
      />
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

  .new-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 0.625rem;
    text-align: center;
    border: 1.5px dashed var(--color-border);
    border-radius: calc(var(--border-radius) * 1.5);
    background: var(--color-bg);
    font: var(--font-body2);
    color: var(--color-text-muted);
    transition: all 0.15s ease;

    &.dropping {
      border-color: var(--color-info);
      background: var(--color-bg-hover);
    }
  }
</style>
