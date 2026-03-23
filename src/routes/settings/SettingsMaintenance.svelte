<script lang="ts">
  import { IconFileAlert, IconDatabase } from "@tabler/icons-svelte";
  import { SettingsMaintenance } from "./settingsMaintenance.svelte.js";

  const ui = new SettingsMaintenance();
</script>

<!-- 缺失檔案 -->
<div class="tool-card">
  <div class="tool-header">
    <IconFileAlert size={18} />
    <h3 class="tool-title">缺失檔案檢查</h3>
  </div>
  <p class="tool-desc">
    掃描資料庫，找出有記錄但對應檔案已不存在的項目。這類記錄通常因檔案曾被手動刪除而產生。檢查後可選擇移除這些失效的資料庫記錄。
  </p>
  <div class="tool-actions">
    <button
      class="btn-outlined btn-sm"
      class:pending={ui.missingBusy}
      onclick={ui.handleMissingCheckClick}
      disabled={ui.missingBusy}
    >
      <span>開始檢查</span>
    </button>
    {#if ui.missingList.length > 0}
      <button
        class="btn-destructive btn-sm"
        class:pending={ui.missingBusy}
        onclick={ui.handleMissingDeleteClick}
        disabled={ui.missingBusy}
      >
        <span>刪除 {ui.missingList.length} 個缺失記錄</span>
      </button>
    {/if}
  </div>
  {#if ui.missingResult}
    <p class="tool-result">{ui.missingResult}</p>
  {/if}
  {#if ui.missingList.length > 0}
    <ul class="tool-file-list">
      {#each ui.missingList as id}
        <li>{id}</li>
      {/each}
    </ul>
  {/if}
</div>

<!-- 備份 -->
<div class="tool-card">
  <div class="tool-header">
    <IconDatabase size={18} />
    <h3 class="tool-title">備份</h3>
  </div>
  <p class="tool-desc">將目前的圖片集（images/ 目錄與 db.json）打包為 ZIP 備份檔，下載至你的裝置。</p>
  <div class="tool-actions">
    <button
      class="btn-outlined btn-sm"
      class:pending={ui.backupBusy}
      onclick={ui.handleBackupClick}
      disabled={ui.backupBusy}
    >
      <span>下載備份</span>
    </button>
  </div>
  {#if ui.backupResult}
    <p class="tool-result">{ui.backupResult}</p>
  {/if}
</div>

<style>
  .tool-card {
    padding: 1.25rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) * 1.5);
    margin-bottom: 1rem;
  }

  .tool-card:last-child {
    margin-bottom: 0;
  }

  .tool-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    color: var(--text);
  }

  .tool-title {
    font-size: 0.9375rem;
    font-weight: 500;
  }

  .tool-desc {
    color: var(--text-muted);
    font-size: 0.8125rem;
    line-height: 1.7;
    margin-bottom: 1rem;
  }

  .tool-actions {
    display: flex;
    gap: 0.5rem;
  }

  .tool-result {
    margin-top: 0.75rem;
    font-size: 0.8125rem;
    color: var(--text-muted);
  }

  .tool-file-list {
    margin-top: 0.5rem;
    padding-left: 1.25rem;
    font-size: 0.8125rem;
    color: var(--text-dim);
    line-height: 1.6;
    max-height: 12rem;
    overflow-y: auto;
  }
</style>
