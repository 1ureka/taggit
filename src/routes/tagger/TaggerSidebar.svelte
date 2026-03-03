<script lang="ts">
  import { IconRefresh, IconUpload } from "@tabler/icons-svelte";
  import { fileStore, selectionStore, uiStore } from "./stores.svelte.js";
  import { select, refresh, uploadFiles } from "./actions.js";

  // ── Virtual list constants ────────────────────────────────
  const ITEM_H = 72;
  const BUFFER = 5;

  // ── DOM refs ──────────────────────────────────────────────
  let listEl: HTMLDivElement | undefined = $state();
  let fileInputEl: HTMLInputElement | undefined = $state();

  // ── Scroll tracking ───────────────────────────────────────
  let scrollTop = $state(0);
  let viewH = $state(400);

  // ── Derived virtual list state ────────────────────────────
  let totalH = $derived(fileStore.list.length * ITEM_H);
  let startIdx = $derived(Math.max(0, Math.floor(scrollTop / ITEM_H) - BUFFER));
  let endIdx = $derived(Math.min(fileStore.list.length, Math.ceil((scrollTop + viewH) / ITEM_H) + BUFFER));
  let visible = $derived(
    fileStore.list.slice(startIdx, endIdx).map((filename, i) => ({
      filename,
      index: startIdx + i,
    })),
  );

  // Track container height via ResizeObserver
  $effect(() => {
    if (!listEl) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) viewH = e.contentRect.height;
    });
    ro.observe(listEl);
    return () => ro.disconnect();
  });

  // React to navigation: scroll active item into view
  $effect(() => {
    const tick = uiStore.navigationTick;
    if (tick === 0) return;
    scrollToActive(selectionStore.cursor);
  });

  function scrollToActive(idx: number) {
    if (!listEl) return;
    const top = idx * ITEM_H;
    const bottom = top + ITEM_H;
    if (top < listEl.scrollTop) {
      listEl.scrollTop = top;
    } else if (bottom > listEl.scrollTop + viewH) {
      listEl.scrollTop = bottom - viewH;
    }
  }

  function handleClick(e: MouseEvent, idx: number) {
    const mode = e.ctrlKey || e.metaKey ? "ctrl" : e.shiftKey ? "shift" : "single";
    select(idx, mode);
  }

  async function handleUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    await uploadFiles(input.files);
    input.value = "";
  }
</script>

<aside class="tagger-sidebar">
  <div class="tagger-sidebar-header">
    <span class="tagger-sidebar-title">待審查</span>
    <span class="badge"
      >{selectionStore.selected.size > 1 ? `${selectionStore.selected.size}/` : ""}{fileStore.list.length}</span
    >
    <button
      class="btn-refresh"
      class:spinning={fileStore.refreshing}
      title="重新掃描 staged 資料夾"
      onclick={refresh}
      disabled={fileStore.refreshing}
    >
      <IconRefresh size={14} />
    </button>
  </div>

  <div class="tagger-sidebar-list" bind:this={listEl} onscroll={() => listEl && (scrollTop = listEl.scrollTop)}>
    {#if fileStore.list.length === 0}
      <div class="tagger-empty">沒有待審查的圖片</div>
    {:else}
      <div class="virtual-scroll-content" style="height:{totalH}px">
        {#each visible as item (item.filename)}
          <button
            type="button"
            class="tagger-thumb"
            class:active={item.index === selectionStore.cursor}
            class:selected={selectionStore.selected.has(item.index)}
            style="top:{item.index * ITEM_H}px"
            onclick={(e) => handleClick(e, item.index)}
          >
            <img
              class="tagger-thumb-img"
              src="/img/staged/{encodeURIComponent(item.filename)}"
              alt={item.filename}
              loading="lazy"
            />
            <span class="tagger-thumb-name">{item.filename}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="tagger-sidebar-footer">
    <input
      bind:this={fileInputEl}
      type="file"
      accept="image/*"
      multiple
      class="visually-hidden"
      onchange={handleUpload}
    />
    <button class="btn btn-sm tagger-upload-btn" onclick={() => fileInputEl?.click()} disabled={fileStore.uploading}>
      <IconUpload size={14} />
      {fileStore.uploading ? "上傳中..." : "加入圖片"}
    </button>
  </div>
</aside>

<style>
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
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid var(--border);
  }

  .btn-refresh {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    margin-left: auto;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: var(--radius);
    color: var(--text-dim);
    cursor: pointer;
    transition:
      color 0.15s,
      background 0.15s;
  }

  .btn-refresh:hover {
    color: var(--text);
    background: var(--bg-hover);
  }

  .btn-refresh:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .btn-refresh.spinning :global(svg) {
    animation: spin 0.8s linear infinite;
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

  .virtual-scroll-content {
    position: relative;
  }

  .tagger-thumb {
    position: absolute;
    left: 0;
    height: 72px;
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

  .tagger-thumb.selected {
    background: var(--bg-active);
    border-left-color: var(--text-dim);
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

  .tagger-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 0.875rem;
    color: var(--text-dim);
  }

  .tagger-sidebar-footer {
    padding: 0.5rem 0.75rem;
    border-top: 1px solid var(--border);
  }

  .tagger-upload-btn {
    width: 100%;
  }
</style>
