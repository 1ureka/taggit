<script lang="ts">
  import { IconRefresh } from "@tabler/icons-svelte";
  import { TaggerRefresh } from "./taggerRefresh.svelte.js";

  type Props = {
    stagedFiles: string[];
    selectedFiles: Set<string>;
    loading: boolean;
  };

  let { stagedFiles, selectedFiles, loading = $bindable() }: Props = $props();

  const ui = new TaggerRefresh({
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

<header>
  <span class="title">待審查</span>
  <span class="badge">{ui.badgeLabel}</span>
  <button
    class:spinning={ui.loading}
    title="重新掃描 staged 資料夾"
    onclick={ui.handleRefreshClick}
    disabled={ui.loading}
  >
    <IconRefresh size={14} />
  </button>
</header>

<style>
  header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid var(--border);
  }

  .title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  button {
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

    &:hover {
      color: var(--text);
      background: var(--bg-hover);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    &.spinning :global(svg) {
      animation: spin 0.8s linear infinite;
    }
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
