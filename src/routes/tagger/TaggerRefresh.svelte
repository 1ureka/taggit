<script lang="ts">
  import { IconRefresh } from "@tabler/icons-svelte";
  import { createTaggerRefresh } from "./taggerRefresh.svelte.js";

  type Props = {
    stagedFiles: string[];
    selectedFiles: Set<string>;
    loading: boolean;
  };

  let { stagedFiles, selectedFiles, loading = $bindable() }: Props = $props();

  const ui = createTaggerRefresh({
    get stagedFiles() {
      return stagedFiles;
    },
    get selectedFiles() {
      return selectedFiles;
    },
    get loading() {
      return loading;
    },
    set loading(v) {
      loading = v;
    },
  });
</script>

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

<style>
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
</style>
