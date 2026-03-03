<script lang="ts">
  import { untrack } from "svelte";

  import { api } from "$lib/client/api.js";
  import { addToast } from "$lib/client/toast.js";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import TooSmallOverlay from "$lib/components/TooSmallOverlay.svelte";

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
  let activeIndex = $state(-1);
  let selectedIndices = $state<Set<number>>(new Set());
  let anchorIndex = $state(0);
  let currentTags = $state<string[]>([]);
  let currentRating = $state(0);
  let previousTags = $state<string[]>([]);
  let totalInitial = $state(untrack(() => data.stagedFiles.length));
  let processedCount = $state(0);
  let showToolsModal = $state(false);
  let confirmModal = $state<{ message: string; resolve: (v: boolean) => void } | null>(null);
  let committing = $state(false);

  // Component refs
  let sidebarRef = $state<TaggerSidebar>();
  let previewRef = $state<TaggerPreview>();
  let tagPanelRef = $state<TaggerTagPanel>();

  // Viewport size
  let windowWidth = $state(900);
  let windowHeight = $state(600);
  const MIN_WIDTH = 860;
  const MIN_HEIGHT = 500;
  let tooSmall = $derived(windowWidth < MIN_WIDTH || windowHeight < MIN_HEIGHT);

  // ─── Derived ──────────────────────────────────────────────────────────
  let currentFilename = $derived(
    activeIndex >= 0 && activeIndex < stagedFiles.length ? stagedFiles[activeIndex] : null,
  );
  let previewSrc = $derived(currentFilename ? `/img/staged/${encodeURIComponent(currentFilename)}` : "");
  let progressPct = $derived(totalInitial > 0 ? Math.round((processedCount / totalInitial) * 100) : 0);
  let progressLabel = $derived(`${processedCount}/${totalInitial} (${stagedFiles.length} 剩餘)`);
  let selectedCount = $derived(selectedIndices.size);

  // ─── Init on mount ────────────────────────────────────────────────────
  $effect(() => {
    if (stagedFiles.length > 0 && activeIndex < 0) {
      selectImage(0, "single");
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
  let refreshing = $state(false);

  async function refreshStaged() {
    refreshing = true;
    try {
      const res = await api.get<{ files: string[] }>("/api/staged");
      if (res.ok && res.data) {
        const oldLen = stagedFiles.length;
        stagedFiles = res.data.files;
        selectedIndices = new Set();
        if (stagedFiles.length === 0) {
          activeIndex = -1;
        } else if (activeIndex >= stagedFiles.length) {
          selectImage(Math.max(0, stagedFiles.length - 1), "single");
        } else if (oldLen === 0 && stagedFiles.length > 0) {
          selectImage(0, "single");
        }
        const diff = stagedFiles.length - oldLen;
        if (diff > 0) {
          if (totalInitial === 0) {
            // 首次從空白載入：直接設為總數
            totalInitial = stagedFiles.length;
          } else {
            // 已有進度中途新增：只累加新增量
            totalInitial += diff;
          }
          addToast(`發現 ${diff} 張新圖片`, "success");
        } else if (diff === 0) {
          addToast("沒有發現新圖片", "info");
        } else {
          addToast(`列表已更新（減少 ${-diff} 張）`, "info");
        }
      }
    } finally {
      refreshing = false;
    }
  }

  async function refreshTags() {
    const res = await api.get<{ tags: TagInfo[] }>("/api/metadata/tags");
    if (res.ok && res.data) {
      allTags = res.data.tags;
    }
  }

  // ─── Image selection ──────────────────────────────────────────────────
  function selectImage(idx: number, mode: "single" | "ctrl" | "shift" = "single") {
    if (idx < 0 || idx >= stagedFiles.length) return;

    if (mode === "single") {
      activeIndex = idx;
      selectedIndices = new Set([idx]);
      anchorIndex = idx;
      currentTags = [];
      currentRating = 0;
      previewRef?.resetZoom();
    } else if (mode === "ctrl") {
      const next = new Set(selectedIndices);
      if (next.has(idx)) {
        next.delete(idx);
        if (next.size === 0) next.add(idx);
      } else {
        next.add(idx);
      }
      activeIndex = idx;
      selectedIndices = next;
      anchorIndex = idx;
      previewRef?.resetZoom();
    } else if (mode === "shift") {
      const start = Math.min(anchorIndex, idx);
      const end = Math.max(anchorIndex, idx);
      const next = new Set<number>();
      for (let i = start; i <= end; i++) next.add(i);
      activeIndex = idx;
      selectedIndices = next;
      previewRef?.resetZoom();
    }

    sidebarRef?.scrollToActive(idx);

    // Preload next image
    const nextIdx = idx + 1;
    if (nextIdx < stagedFiles.length) {
      const img = new Image();
      img.src = `/img/staged/${encodeURIComponent(stagedFiles[nextIdx])}`;
    }
  }

  // ─── Image dimensions helper ─────────────────────────────────────────
  function loadImageDimensions(src: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = src;
    });
  }

  // ─── Commit ───────────────────────────────────────────────────────────
  async function commitSelected() {
    if (selectedIndices.size === 0 || activeIndex < 0) return;
    if (committing) return;

    if (currentTags.length === 0) {
      addToast("請至少加入一個標籤才能提交", "error");
      return;
    }

    committing = true;
    const indicesToRemove = new Set(selectedIndices);
    const filenames = [...indicesToRemove].sort((a, b) => a - b).map((i) => stagedFiles[i]);

    const BATCH_SIZE = 5;
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < filenames.length; i += BATCH_SIZE) {
        const batch = filenames.slice(i, i + BATCH_SIZE);
        const dims = await Promise.all(batch.map((fn) => loadImageDimensions(`/img/staged/${encodeURIComponent(fn)}`)));
        const results = await Promise.all(
          batch.map((fn, j) =>
            api.post<{ id: string }>(`/api/staged/${encodeURIComponent(fn)}`, {
              tags: currentTags,
              rating: currentRating,
              width: dims[j].width,
              height: dims[j].height,
            }),
          ),
        );
        for (const res of results) {
          if (res.ok) successCount++;
          else failCount++;
        }
      }

      if (successCount > 0) {
        previousTags = [...currentTags];
        processedCount += successCount;
        addToast(successCount === 1 ? `已提交: ${filenames[0]}` : `已提交 ${successCount} 張圖片`, "success");
      }
      if (failCount > 0) {
        addToast(`${failCount} 張提交失敗`, "error");
      }

      stagedFiles = stagedFiles.filter((_, i) => !indicesToRemove.has(i));
      afterRemove();
      refreshTags();
    } finally {
      committing = false;
    }
  }

  // ─── Trash ────────────────────────────────────────────────────────────
  async function trashSelected() {
    if (selectedIndices.size === 0 || activeIndex < 0) return;

    const count = selectedIndices.size;
    const message =
      count === 1
        ? `確定要將「${stagedFiles[activeIndex]}」移至垃圾桶？`
        : `確定要將選取的 ${count} 張圖片移至垃圾桶？`;
    const ok = await confirmDialog(message);
    if (!ok) return;

    const indicesToRemove = new Set(selectedIndices);
    const filenames = [...indicesToRemove].sort((a, b) => a - b).map((i) => stagedFiles[i]);

    const BATCH_SIZE = 5;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < filenames.length; i += BATCH_SIZE) {
      const batch = filenames.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((fn) => api.del<{ trashName: string }>(`/api/staged/${encodeURIComponent(fn)}`)),
      );
      for (const res of results) {
        if (res.ok) successCount++;
        else failCount++;
      }
    }

    if (successCount > 0) {
      processedCount += successCount;
      addToast(successCount === 1 ? `已移至垃圾桶: ${filenames[0]}` : `已將 ${successCount} 張圖片移至垃圾桶`, "info");
    }
    if (failCount > 0) {
      addToast(`${failCount} 張刪除失敗`, "error");
    }

    stagedFiles = stagedFiles.filter((_, i) => !indicesToRemove.has(i));
    afterRemove();
  }

  // ─── After Remove ─────────────────────────────────────────────────────
  function afterRemove() {
    selectedIndices = new Set();
    if (stagedFiles.length === 0) {
      activeIndex = -1;
      return;
    }
    const nextIdx = Math.min(activeIndex, stagedFiles.length - 1);
    selectImage(nextIdx, "single");
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
        if (activeIndex > 0) selectImage(activeIndex - 1, "single");
        break;
      case "ArrowRight":
        e.preventDefault();
        if (activeIndex < stagedFiles.length - 1) selectImage(activeIndex + 1, "single");
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
        commitSelected();
        break;
      case "Delete":
        e.preventDefault();
        trashSelected();
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

<svelte:window onkeydown={handleKeydown} bind:innerWidth={windowWidth} bind:innerHeight={windowHeight} />

<TaggerHeader {progressPct} {progressLabel} onopentools={() => (showToolsModal = true)} />

{#if tooSmall}
  <TooSmallOverlay
    minWidth={MIN_WIDTH}
    minHeight={MIN_HEIGHT}
    currentWidth={windowWidth}
    currentHeight={windowHeight}
    label="Tagger"
  />
{:else}
  <main class="tagger-main">
    <TaggerSidebar
      bind:this={sidebarRef}
      {stagedFiles}
      {activeIndex}
      {selectedIndices}
      {refreshing}
      onselect={selectImage}
      onrefresh={refreshStaged}
    />

    <TaggerPreview bind:this={previewRef} {currentFilename} {previewSrc} {selectedCount} />

    <TaggerTagPanel
      bind:this={tagPanelRef}
      {allTags}
      bind:currentTags
      bind:currentRating
      {selectedCount}
      {committing}
      oncommit={commitSelected}
      ontrash={trashSelected}
      oncopyprevious={copyPreviousTags}
    />
  </main>
{/if}

<TaggerToolsModal bind:show={showToolsModal} {allTags} ontagschanged={refreshTags} />

{#if confirmModal}
  <ConfirmModal message={confirmModal.message} onconfirm={handleConfirm} oncancel={handleCancel} />
{/if}

<style>
  .tagger-main {
    display: flex;
    height: calc(100vh - 3rem);
    margin-top: 3rem;
  }
</style>
