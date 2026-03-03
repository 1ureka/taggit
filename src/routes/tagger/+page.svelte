<script lang="ts">
  import { IconArrowLeft, IconTool, IconClipboard, IconCheck, IconTrash } from "@tabler/icons-svelte";
  import { IconFileSearch, IconFileAlert, IconTag, IconDatabase, IconTrashX } from "@tabler/icons-svelte";
  import { addToast } from "$lib/stores/toast.js";
  import { api } from "$lib/client/api.js";
  import Rating from "$lib/components/Rating.svelte";
  import TagAutocomplete from "$lib/components/TagAutocomplete.svelte";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import { untrack } from "svelte";
  import type { TagInfo } from "$lib/types.js";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();

  // ─── State ────────────────────────────────────────────────────────────
  // Intentionally capture SSR data once (then managed via client fetch)
  let stagedFiles = $state<string[]>(untrack(() => [...data.stagedFiles]));
  let allTags = $state<TagInfo[]>(untrack(() => [...data.allTags]));
  let currentIndex = $state(-1);
  let currentTags = $state<string[]>([]);
  let currentRating = $state(0);
  let previousTags = $state<string[]>([]);
  let totalInitial = $state(untrack(() => data.stagedFiles.length));
  let processedCount = $state(0);

  // Zoom / pan
  let scale = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let isDragging = $state(false);
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartPanX = 0;
  let dragStartPanY = 0;

  // UI state
  let showToolsModal = $state(false);
  let toolResult = $state("");
  let confirmModal = $state<{ message: string; resolve: (v: boolean) => void } | null>(null);
  let previewImg: HTMLImageElement | undefined = $state();
  let sidebarListEl: HTMLDivElement | undefined = $state();

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
    resetZoom();

    // Scroll active thumb into view
    requestAnimationFrame(() => {
      const thumbs = sidebarListEl?.querySelectorAll(".tagger-thumb");
      thumbs?.[idx]?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });

    // Preload next
    const nextIdx = idx + 1;
    if (nextIdx < stagedFiles.length) {
      const img = new Image();
      img.src = `/img/staged/${encodeURIComponent(stagedFiles[nextIdx])}`;
    }
  }

  // ─── Zoom / Pan ───────────────────────────────────────────────────────
  function resetZoom() {
    scale = 1;
    panX = 0;
    panY = 0;
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    scale = Math.max(0.2, Math.min(10, scale + delta * scale));
  }

  function handlePreviewMousedown(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartPanX = panX;
    dragStartPanY = panY;
  }

  function handleWindowMousemove(e: MouseEvent) {
    if (!isDragging) return;
    panX = dragStartPanX + (e.clientX - dragStartX);
    panY = dragStartPanY + (e.clientY - dragStartY);
  }

  function handleWindowMouseup() {
    isDragging = false;
  }

  // ─── Tag editing ──────────────────────────────────────────────────────
  function addTag(rawTag: string) {
    const tag = rawTag.trim().toLowerCase();
    if (!tag) return;
    if (currentTags.includes(tag)) {
      addToast("標籤已存在", "info");
      return;
    }
    currentTags = [...currentTags, tag];
  }

  function removeTag(tag: string) {
    currentTags = currentTags.filter((t) => t !== tag);
  }

  function removeLastTag() {
    if (currentTags.length > 0) {
      currentTags = currentTags.slice(0, -1);
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
    const w = previewImg?.naturalWidth || 0;
    const h = previewImg?.naturalHeight || 0;

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

    // Don't intercept when typing in an input (except specific keys)
    if (inInput) return;

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
        // Focus the tag input inside TagAutocomplete
        (document.querySelector(".tagger-tags-input-wrap input") as HTMLInputElement)?.focus();
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

  // ─── Tools Modal Actions ──────────────────────────────────────────────
  async function toolCheckOrphans() {
    toolResult = "檢查中...";
    const res = await api.get<{ orphans: string[] }>("/api/maintenance/orphans");
    if (res.ok && res.data) {
      const orphans = res.data.orphans;
      if (orphans.length === 0) {
        toolResult = "✓ 沒有找到孤立檔案";
      } else {
        toolResult = `找到 ${orphans.length} 個孤立檔案:\n${orphans.map((f) => "  • " + f).join("\n")}`;
      }
    } else {
      toolResult = "錯誤: " + (res.error || "未知");
    }
  }

  async function toolCheckMissing() {
    toolResult = "檢查中...";
    const res = await api.get<{ missing: string[] }>("/api/maintenance/missing");
    if (res.ok && res.data) {
      const missing = res.data.missing;
      if (missing.length === 0) {
        toolResult = "✓ 沒有找到缺失檔案";
      } else {
        toolResult = `找到 ${missing.length} 個缺失記錄:\n${missing.map((m) => "  • " + m).join("\n")}`;
      }
    } else {
      toolResult = "錯誤: " + (res.error || "未知");
    }
  }

  async function toolRenameTag() {
    const from = prompt("舊標籤名稱:");
    if (!from) return;
    const to = prompt("新標籤名稱:");
    if (!to) return;

    toolResult = "重命名中...";
    const res = await api.post<{ affected: number }>("/api/metadata/tags", {
      oldName: from.trim(),
      newName: to.trim(),
    });
    if (res.ok && res.data) {
      toolResult = `✓ 已將「${from.trim()}」重命名為「${to.trim()}」，影響 ${res.data.affected} 張圖片`;
      refreshTags();
    } else {
      toolResult = "錯誤: " + (res.error || "未知");
    }
  }

  async function toolBackup() {
    toolResult = "備份中...";
    const res = await api.post<{ backupPath: string }>("/api/maintenance/backup");
    if (res.ok && res.data) {
      toolResult = "✓ 備份完成: " + res.data.backupPath;
    } else {
      toolResult = "錯誤: " + (res.error || "未知");
    }
  }

  async function toolEmptyTrash() {
    const ok = await confirmDialog("確定要清空垃圾桶？此操作無法復原。");
    if (!ok) return;

    toolResult = "清空中...";
    const res = await api.del<{ deleted: number }>("/api/trash");
    if (res.ok && res.data) {
      toolResult = `✓ 已清空垃圾桶，刪除 ${res.data.deleted} 個檔案`;
    } else {
      toolResult = "錯誤: " + (res.error || "未知");
    }
  }
</script>

<svelte:head>
  <title>Tagger — Image Manager</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} onmousemove={handleWindowMousemove} onmouseup={handleWindowMouseup} />

<!-- ─── Header ─────────────────────────────────────────────────────────── -->
<header class="tagger-header">
  <a href="/" class="btn btn-ghost btn-sm">
    <IconArrowLeft size={16} />
    首頁
  </a>
  <div class="tagger-progress">
    <div class="progress-bar">
      <div class="progress-bar-fill" style="width:{progressPct}%"></div>
    </div>
    <span class="tagger-progress-text">{progressLabel}</span>
  </div>
  <div class="tagger-header-actions">
    <button
      class="btn btn-sm"
      onclick={() => {
        showToolsModal = true;
        toolResult = "";
      }}
    >
      <IconTool size={16} />
      工具
    </button>
  </div>
</header>

<!-- ─── Main Three-Column Layout ───────────────────────────────────────── -->
<main class="tagger-main">
  <!-- ─── Sidebar (Left) ─────────────────────────────────────────────── -->
  <aside class="tagger-sidebar">
    <div class="tagger-sidebar-header">
      <span class="tagger-sidebar-title">待審查</span>
      <span class="badge">{stagedFiles.length}</span>
    </div>
    <div class="tagger-sidebar-list" bind:this={sidebarListEl}>
      {#if stagedFiles.length === 0}
        <div class="tagger-empty">沒有待審查的圖片</div>
      {:else}
        {#each stagedFiles as filename, idx}
          <button
            type="button"
            class="tagger-thumb"
            class:active={idx === currentIndex}
            onclick={() => selectImage(idx)}
          >
            <img
              class="tagger-thumb-img"
              src="/img/staged/{encodeURIComponent(filename)}"
              alt={filename}
              loading="lazy"
            />
            <span class="tagger-thumb-name">{filename}</span>
          </button>
        {/each}
      {/if}
    </div>
  </aside>

  <!-- ─── Preview (Center) ───────────────────────────────────────────── -->
  <section class="tagger-preview">
    {#if currentFilename}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="tagger-preview-container"
        class:dragging={isDragging}
        onwheel={handleWheel}
        onmousedown={handlePreviewMousedown}
        ondblclick={resetZoom}
        role="img"
      >
        <img
          bind:this={previewImg}
          src={previewSrc}
          alt={currentFilename}
          draggable="false"
          style="transform:translate({panX}px,{panY}px) scale({scale})"
        />
      </div>
      <div class="tagger-preview-info">{currentFilename}</div>
    {:else}
      <div class="tagger-preview-container">
        <div class="tagger-empty">所有圖片皆已處理，沒有新圖片</div>
      </div>
      <div class="tagger-preview-info">所有圖片皆已處理，沒有新圖片</div>
    {/if}
  </section>

  <!-- ─── Tag Panel (Right) ──────────────────────────────────────────── -->
  <aside class="tagger-panel">
    <div class="tagger-rating">
      <Rating bind:value={currentRating} size="1.5rem" />
    </div>
    <div class="separator"></div>

    <div class="tagger-tags">
      <div class="tagger-tags-list">
        {#each currentTags as tag}
          <button type="button" class="chip chip-removable" onclick={() => removeTag(tag)}>
            <span>{tag}</span>
            <span class="chip-remove">x</span>
          </button>
        {/each}
      </div>
      <div class="tagger-tags-input-wrap">
        <TagAutocomplete
          {allTags}
          excludedTags={currentTags}
          placeholder="輸入標籤..."
          onselect={addTag}
          oncommit={commitCurrent}
          onbackspace={removeLastTag}
        />
      </div>
    </div>

    <div class="separator"></div>

    <div class="tagger-actions">
      <button class="btn btn-sm" onclick={copyPreviousTags} title="複製上一張標籤">
        <IconClipboard size={16} />
        複製上一張
      </button>
      <button class="btn btn-primary btn-sm" onclick={commitCurrent}>
        <IconCheck size={16} />
        提交
      </button>
      <button class="btn btn-destructive btn-sm" onclick={trashCurrent}>
        <IconTrash size={16} />
        刪除
      </button>
    </div>

    <div class="separator"></div>

    <div class="tagger-shortcuts">
      <div>
        <div><span class="kbd">←</span><span class="kbd">→</span></div>
        切換圖片
      </div>
      <div>
        <div><span class="kbd">1</span>-<span class="kbd">5</span></div>
        評等
      </div>
      <div>
        <div><span class="kbd">T</span></div>
        聚焦標籤
      </div>
      <div>
        <div><span class="kbd">C</span></div>
        複製標籤
      </div>
      <div>
        <div><span class="kbd">Enter</span></div>
        提交
      </div>
    </div>
  </aside>
</main>

<!-- ─── Tools Modal ──────────────────────────────────────────────────── -->
{#if showToolsModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay"
    onclick={(e) => {
      if (e.target === e.currentTarget) showToolsModal = false;
    }}
  >
    <div class="modal" style="max-width:36rem">
      <div class="modal-title">工具</div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:0.5rem">
        <button class="btn" onclick={toolCheckOrphans}>
          <IconFileSearch size={16} />
          檢查孤立檔案
        </button>
        <button class="btn" onclick={toolCheckMissing}>
          <IconFileAlert size={16} />
          檢查缺失檔案
        </button>
        <button class="btn" onclick={toolRenameTag}>
          <IconTag size={16} />
          標籤重命名
        </button>
        <button class="btn" onclick={toolBackup}>
          <IconDatabase size={16} />
          資料庫備份
        </button>
        <button class="btn btn-destructive" onclick={toolEmptyTrash}>
          <IconTrashX size={16} />
          清空垃圾桶
        </button>
      </div>
      <div class="modal-actions" style="margin-top:1rem">
        <button class="btn" onclick={() => (showToolsModal = false)}>關閉</button>
      </div>
      {#if toolResult}
        <div style="margin-top:0.75rem;font-size:0.8125rem;color:var(--text-muted);white-space:pre-wrap">
          {toolResult}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- ─── Confirm Modal ────────────────────────────────────────────────── -->
{#if confirmModal}
  <ConfirmModal message={confirmModal.message} onconfirm={handleConfirm} oncancel={handleCancel} />
{/if}

<style>
  /* ─── Tagger Layout ──────────────────────────────────────────────────── */

  .tagger-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 3rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0 1rem;
    background: var(--bg-card);
    border-bottom: 1px solid var(--border);
    z-index: 100;
  }

  .tagger-progress {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    max-width: 24rem;
  }

  .tagger-progress-text {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
    min-width: 3.5rem;
    text-align: right;
  }

  .tagger-header-actions {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
  }

  /* ─── Main Three-Column Layout ───────────────────────────────────────── */

  .tagger-main {
    display: flex;
    height: calc(100vh - 3rem);
    margin-top: 3rem;
  }

  /* ─── Sidebar (Left) ─────────────────────────────────────────────────── */

  .tagger-sidebar {
    width: 220px;
    min-width: 220px;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border);
    background: var(--bg-card);
    overflow: hidden;
  }

  .tagger-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid var(--border);
  }

  .tagger-sidebar-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .tagger-sidebar-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* ─── Sidebar Thumbnails ─────────────────────────────────────────────── */

  .tagger-thumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    cursor: pointer;
    border: none;
    border-left: 3px solid transparent;
    background: transparent;
    width: 100%;
    text-align: left;
    color: inherit;
    font-family: inherit;
    transition:
      background 0.1s,
      border-color 0.15s;
    user-select: none;
  }

  .tagger-thumb:hover {
    background: var(--bg-hover);
  }

  .tagger-thumb.active {
    background: var(--bg-active);
    border-left-color: var(--accent);
  }

  .tagger-thumb-img {
    width: auto;
    height: 60px;
    max-width: 80px;
    object-fit: cover;
    border-radius: 4px;
    background: var(--bg);
    flex-shrink: 0;
  }

  .tagger-thumb-name {
    flex: 1;
    font-size: 0.6875rem;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  /* ─── Preview (Center) ───────────────────────────────────────────────── */

  .tagger-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
    min-width: 0;
  }

  .tagger-preview-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    cursor: grab;
    position: relative;
    user-select: none;
    -webkit-user-select: none;
  }

  .tagger-preview-container.dragging {
    cursor: grabbing;
  }

  .tagger-preview-container img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    transform-origin: center center;
    transition: none;
    user-select: none;
    -webkit-user-drag: none;
    pointer-events: none;
  }

  .tagger-preview-info {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.6875rem;
    color: var(--text-dim);
    border-top: 1px solid var(--border);
    background: var(--bg-card);
    min-height: 1.75rem;
  }

  /* ─── Tag Panel (Right) ──────────────────────────────────────────────── */

  .tagger-panel {
    width: 280px;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    border-left: 1px solid var(--border);
    background: var(--bg-card);
    overflow-y: auto;
  }

  .tagger-rating {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0;
  }

  .tagger-tags {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .tagger-tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
    max-height: 12rem;
    overflow-y: auto;
    align-content: flex-start;
  }

  .tagger-tags-input-wrap {
    position: relative;
  }

  .tagger-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .tagger-actions :global(.btn) {
    flex: 1;
    min-width: 0;
  }

  /* ─── Shortcuts ──────────────────────────────────────────────────────── */

  .tagger-shortcuts {
    display: grid;
    grid-template-columns: max-content 1fr max-content 1fr;
    gap: 0.25rem 2rem;
    font-size: 0.6875rem;
    color: var(--text-muted);
  }

  .tagger-shortcuts > div {
    grid-column: span 2;
    display: grid;
    grid-template-columns: subgrid;
    align-items: center;
    gap: 0.25rem;
  }

  /* ─── Empty State ────────────────────────────────────────────────────── */

  .tagger-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 0.875rem;
    color: var(--text-dim);
  }

  /* ─── Mobile Responsive ──────────────────────────────────────────────── */

  @media (max-width: 768px) {
    .tagger-main {
      flex-direction: column;
    }

    .tagger-sidebar {
      width: 100%;
      min-width: 0;
      max-height: 120px;
      border-right: none;
      border-bottom: 1px solid var(--border);
    }

    .tagger-sidebar-list {
      display: flex;
      flex-direction: row;
      overflow-x: auto;
      overflow-y: hidden;
    }

    .tagger-thumb {
      flex-direction: column;
      min-width: 80px;
      border-left: none;
      border-bottom: 3px solid transparent;
      padding: 0.25rem;
      text-align: center;
    }

    .tagger-thumb.active {
      border-left-color: transparent;
      border-bottom-color: var(--accent);
    }

    .tagger-thumb-img {
      height: 48px;
      max-width: 64px;
    }

    .tagger-preview {
      flex: 1;
      min-height: 0;
    }

    .tagger-panel {
      width: 100%;
      min-width: 0;
      max-height: 40vh;
      border-left: none;
      border-top: 1px solid var(--border);
      overflow-y: auto;
    }

    .tagger-shortcuts {
      display: none;
    }
  }
</style>
