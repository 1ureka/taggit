<script lang="ts">
  import { IconRefresh, IconUpload } from "@tabler/icons-svelte";
  import { createTaggerSidebar } from "./taggerSidebar.svelte.js";
  import TaggerList from "./TaggerList.svelte";

  const ui = createTaggerSidebar();
</script>

<aside class="tagger-sidebar">
  <div class="tagger-sidebar-header">
    <span class="tagger-sidebar-title">待審查</span>
    <span class="badge">{ui.selectedSize > 1 ? `${ui.selectedSize}/` : ""}{ui.listLength}</span>
    <button
      class="btn-refresh"
      class:spinning={ui.loading}
      title="重新掃描 staged 資料夾"
      onclick={ui.handleRefreshClick}
      disabled={ui.loading}
    >
      <IconRefresh size={14} />
    </button>
  </div>

  <TaggerList />

  <div class="tagger-sidebar-footer">
    <input
      bind:this={ui.fileInputEl}
      type="file"
      accept="image/*"
      multiple
      class="visually-hidden"
      onchange={ui.handleUploadChange}
      tabindex={-1}
    />
    <button class="btn btn-sm tagger-upload-btn" onclick={ui.handleUploadClick} disabled={ui.loading}>
      <IconUpload size={14} />
      {ui.loading ? "載入中..." : "加入圖片"}
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

  .tagger-sidebar-footer {
    padding: 0.5rem 0.75rem;
    border-top: 1px solid var(--border);
  }

  .tagger-upload-btn {
    width: 100%;
  }
</style>
