<script lang="ts">
  import { IconFileSearch, IconFileAlert, IconTag, IconDatabase, IconTrashX } from "@tabler/icons-svelte";
  import { uiStore, toolStore } from "./stores.svelte.js";
  import { closeTools, checkOrphans, checkMissing, openRenameModal, backup, emptyTrash } from "./actions.js";
</script>

{#if uiStore.toolsOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay"
    onclick={(e) => {
      if (e.target === e.currentTarget) closeTools();
    }}
  >
    <div class="modal" style="max-width:36rem">
      <div class="modal-title">工具</div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:0.5rem">
        <button class="btn" onclick={checkOrphans}>
          <IconFileSearch size={16} />
          檢查孤立檔案
        </button>
        <button class="btn" onclick={checkMissing}>
          <IconFileAlert size={16} />
          檢查缺失檔案
        </button>
        <button class="btn" onclick={openRenameModal}>
          <IconTag size={16} />
          標籤重命名
        </button>
        <button class="btn" onclick={backup}>
          <IconDatabase size={16} />
          資料庫備份
        </button>
        <button class="btn btn-destructive" onclick={emptyTrash}>
          <IconTrashX size={16} />
          清空垃圾桶
        </button>
      </div>
      <div class="modal-actions" style="margin-top:1rem">
        <button class="btn" onclick={closeTools}>關閉</button>
      </div>
      {#if toolStore.result}
        <div class="tools-result">
          {toolStore.result}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .tools-result {
    margin-top: 0.75rem;
    font-size: 0.8125rem;
    color: var(--text-muted);
    white-space: pre-wrap;
  }
</style>
