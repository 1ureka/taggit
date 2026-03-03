<script lang="ts">
  import { addToast } from "$lib/stores/toast.js";
  import { api } from "$lib/client/api.js";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import { untrack } from "svelte";
  import type { TagInfo } from "$lib/types.js";
  import type { PageData } from "./$types.js";

  import TaggerHeader from "./TaggerHeader.svelte";
  import TaggerSidebar from "./TaggerSidebar.svelte";
  import TaggerPreview from "./TaggerPreview.svelte";
  import TaggerTagPanel from "./TaggerTagPanel.svelte";
  import TaggerToolsModal from "./TaggerToolsModal.svelte";

  let { data }: { data: PageData } = $props();

  // ─── State ────────────────────────────────────────────────────────────
  let stagedFiles = $state<string[]>(untrack(() => [...data.stagedFiles]));
  let allTags = $state<TagInfo[]>(untrack(() => [...data.allTags]));
  let currentIndex = $state(-1);
  let currentTags = $state<string[]>([]);
  let currentRating = $state(0);
  let previousTags = $state<string[]>([]);
  let totalInitial = $state(untrack(() => data.stagedFiles.length));
  let processedCount = $state(0);
  let showToolsModal = $state(false);
  let confirmModal = $state<{ message: string; resolve: (v: boolean) => void } | null>(null);

  // Component refs
  let sidebarRef: TaggerSidebar;
  let previewRef: TaggerPreview;
  let tagPanelRef: TaggerTagPanel;

  // ─── Derived ──────────────────────────────────────────────────────────
  let currentFilename = $derived(
    currentIndex >= 0 && currentIndex < stagedFiles.length ? stagedFiles[currentIndex] : null,
  );
  let previewSrc = $derived(currentFilename ? `/img/staged/${encodeURIComponent(currentFilename)}` : "");
  let progressPct = $derived(totalInitial > 0 ? Math.round((processedCount / totalInitial) * 100) : 0);
  let progressLabel = $derived(`${processedCount}/${totalInitial} (${stagedFiles.length} 剩餘)`);

  // ─── Init on mount ────────────────────────────────────────────────────
  $effect(() => {
    if (stagedFiles.length > 0 && currentIndex < 0) {
      selectImage(0);
    }
  });

  // ─── Confirm helper ───────────────────────────────────────────────────
  function confirmDialog(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      confirmModal = { message, resolve };
    });
  }

  function handleConfirm() {
    confirmModal?.resolve(true);
    confirmModal = null;
  }

  function handleCancel() {
    confirmModal?.resolve(false);
    confirmModal = null;
  }

  // ─── Fetch helpers ────────────────────────────────────────────────────
  async function refreshStaged() {
    const res = await api.get<{ files: string[] }>("/api/staged");
    if (res.ok && res.data) {
      stagedFiles = res.data.files;
      if (totalInitial === 0) totalInitial = stagedFiles.length;
      if (stagedFiles.length === 0) {
        currentIndex = -1;
      } else if (currentIndex >= stagedFiles.length) {
        selectImage(Math.max(0, stagedFiles.length - 1));
      }
    }
  }

  async function refreshTags() {
    const res = await api.get<{ tags: TagInfo[] }>("/api/metadata/tags");
    if (res.ok && res.data) {
      allTags = res.data.tags;
    }
  }

  // ─── Image selection ──────────────────────────────────────────────────
  function selectImage(idx: number) {
    if (idx < 0 || idx >= stagedFiles.length) return;
    currentIndex = idx;
    currentTags = [];
    currentRating = 0;
    previewRef?.resetZoom();
    sidebarRef?.scrollToActive(idx);

    // Preload next image
    const nextIdx = idx + 1;
    if (nextIdx < stagedFiles.length) {
      const img = new Image();
      img.src = `/img/staged/${encodeURIComponent(stagedFiles[nextIdx])}`;
    }
  }

  // ─── Commit ───────────────────────────────────────────────────────────
  async function commitCurrent() {
    if (currentIndex < 0 || currentIndex >= stagedFiles.length) return;

    if (currentTags.length === 0) {
      addToast("請至少加入一個標籤才能提交", "error");
      return;
    }

    const filename = stagedFiles[currentIndex];
    const { width: w, height: h } = previewRef?.getImageDimensions() ?? { width: 0, height: 0 };

    const res = await api.post<{ id: string }>(`/api/staged/${encodeURIComponent(filename)}`, {
      tags: currentTags,
      rating: currentRating,
      width: w,
      height: h,
    });

    if (!res.ok) {
      addToast("提交失敗: " + (res.error || "未知錯誤"), "error");
      return;
    }

    previousTags = [...currentTags];
    processedCount++;
    addToast("已提交: " + filename, "success");

    stagedFiles = stagedFiles.filter((_, i) => i !== currentIndex);
    afterRemove();
    refreshTags();
  }

  // ─── Trash ────────────────────────────────────────────────────────────
  async function trashCurrent() {
    if (currentIndex < 0 || currentIndex >= stagedFiles.length) return;

    const filename = stagedFiles[currentIndex];
    const ok = await confirmDialog(`確定要將「${filename}」移至垃圾桶？`);
    if (!ok) return;

    const res = await api.del<{ trashName: string }>(`/api/staged/${encodeURIComponent(filename)}`);
    if (!res.ok) {
      addToast("刪除失敗: " + (res.error || "未知錯誤"), "error");
      return;
    }

    processedCount++;
    addToast("已移至垃圾桶: " + filename, "info");

    stagedFiles = stagedFiles.filter((_, i) => i !== currentIndex);
    afterRemove();
  }

  // ─── After Remove ─────────────────────────────────────────────────────
  function afterRemove() {
    if (stagedFiles.length === 0) {
      currentIndex = -1;
      return;
    }
    const nextIdx = Math.min(currentIndex, stagedFiles.length - 1);
    selectImage(nextIdx);
  }

  // ─── Copy Previous Tags ──────────────────────────────────────────────
  function copyPreviousTags() {
    if (previousTags.length === 0) {
      addToast("沒有上一張的標籤可以複製", "info");
      return;
    }
    currentTags = [...previousTags];
    addToast(`已複製 ${previousTags.length} 個標籤`, "success");
  }

  // ─── Keyboard Shortcuts ───────────────────────────────────────────────
  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true";

    if (inInput) return;

    // Allow browser-native shortcuts (Ctrl+C copy, Ctrl+V paste, etc.)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        if (currentIndex > 0) selectImage(currentIndex - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (currentIndex < stagedFiles.length - 1) selectImage(currentIndex + 1);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
        e.preventDefault();
        {
          const val = parseInt(e.key, 10);
          currentRating = val === currentRating ? 0 : val;
        }
        break;
      case "0":
        e.preventDefault();
        currentRating = 0;
        break;
      case "t":
      case "T":
        e.preventDefault();
        tagPanelRef?.focusInput();
        break;
      case "c":
      case "C":
        e.preventDefault();
        copyPreviousTags();
        break;
      case "Enter":
        e.preventDefault();
        commitCurrent();
        break;
      case "Delete":
        e.preventDefault();
        trashCurrent();
        break;
      case "Escape":
        e.preventDefault();
        if (showToolsModal) showToolsModal = false;
        break;
    }
  }
</script>

<svelte:head>
  <title>Tagger — Image Manager</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<TaggerHeader
  {progressPct}
  {progressLabel}
  onopentools={() => (showToolsModal = true)}
/>

<main class="tagger-main">
  <TaggerSidebar
    bind:this={sidebarRef}
    {stagedFiles}
    {currentIndex}
    onselect={selectImage}
  />

  <TaggerPreview
    bind:this={previewRef}
    {currentFilename}
    {previewSrc}
  />

  <TaggerTagPanel
    bind:this={tagPanelRef}
    {allTags}
    bind:currentTags
    bind:currentRating
    oncommit={commitCurrent}
    ontrash={trashCurrent}
    oncopyprevious={copyPreviousTags}
  />
</main>

<TaggerToolsModal bind:show={showToolsModal} ontagschanged={refreshTags} />

{#if confirmModal}
  <ConfirmModal message={confirmModal.message} onconfirm={handleConfirm} oncancel={handleCancel} />
{/if}

<style>
  .tagger-main {
    display: flex;
    height: calc(100vh - 3rem);
    margin-top: 3rem;
  }

  @media (max-width: 768px) {
    .tagger-main {
      flex-direction: column;
    }
  }
</style>
