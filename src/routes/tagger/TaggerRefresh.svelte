<script lang="ts">
  import { IconRefresh } from "@tabler/icons-svelte";
  import { TaggerRefresh } from "./taggerRefresh.svelte.js";

  const ui = new TaggerRefresh();
</script>

<button class="btn btn-icon" title="重新掃描 staged 資料夾" onclick={ui.handleRefreshClick} disabled={ui.pending}>
  <IconRefresh size={14} />
</button>

<style>
  button {
    padding: 0.125rem;

    &:disabled :global(svg) {
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
