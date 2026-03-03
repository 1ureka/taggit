<script lang="ts">
  import { IconRefresh, IconUpload } from "@tabler/icons-svelte";
  import { addToast } from "$lib/client/toast.js";

  let {
    stagedFiles,
    currentIndex,
    refreshing = false,
    onselect,
    onrefresh,
  }: {
    stagedFiles: string[];
    currentIndex: number;
    refreshing?: boolean;
    onselect: (idx: number) => void;
    onrefresh: () => void;
  } = $props();

  let sidebarListEl: HTMLDivElement | undefined = $state();
  let fileInputEl: HTMLInputElement | undefined = $state();
  let uploading = $state(false);

  /** Scroll the active thumbnail into view. */
  export function scrollToActive(idx: number) {
    requestAnimationFrame(() => {
      const thumbs = sidebarListEl?.querySelectorAll(".tagger-thumb");
      thumbs?.[idx]?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  async function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    uploading = true;
    try {
      const formData = new FormData();
      for (const f of files) {
        formData.append("files", f);
      }

      const res = await fetch("/api/staged", { method: "POST", body: formData });
      const json = await res.json();

      if (json.ok && json.data) {
        const { added, errors } = json.data as { added: string[]; errors: string[] };
        if (added.length > 0) {
          addToast(`已加入 ${added.length} 張圖片`, "success");
          onrefresh();
        }
        if (errors.length > 0) {
          addToast(`${errors.length} 個檔案失敗`, "error");
        }
      } else {
        addToast(json.error || "上傳失敗", "error");
      }
    } catch {
      addToast("上傳請求失敗", "error");
    } finally {
      uploading = false;
      input.value = "";
    }
  }
</script>

<aside class="tagger-sidebar">
  <div class="tagger-sidebar-header">
    <span class="tagger-sidebar-title">待審查</span>
    <span class="badge">{stagedFiles.length}</span>
    <button
      class="btn-refresh"
      class:spinning={refreshing}
      title="重新掃描 staged 資料夾"
      onclick={onrefresh}
      disabled={refreshing}
    >
      <IconRefresh size={14} />
    </button>
  </div>
  <div class="tagger-sidebar-list" bind:this={sidebarListEl}>
    {#if stagedFiles.length === 0}
      <div class="tagger-empty">沒有待審查的圖片</div>
    {:else}
      {#each stagedFiles as filename, idx}
        <button type="button" class="tagger-thumb" class:active={idx === currentIndex} onclick={() => onselect(idx)}>
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
  <div class="tagger-sidebar-footer">
    <input
      bind:this={fileInputEl}
      type="file"
      accept="image/*"
      multiple
      class="visually-hidden"
      onchange={handleFileSelect}
    />
    <button class="btn btn-sm tagger-upload-btn" onclick={() => fileInputEl?.click()} disabled={uploading}>
      <IconUpload size={14} />
      {uploading ? "上傳中..." : "加入圖片"}
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
