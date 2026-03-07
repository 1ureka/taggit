<script lang="ts">
  import { IconFileSearch, IconFileAlert, IconDatabase, IconTrashX } from "@tabler/icons-svelte";
  import { createSettingsMaintenance } from "./settingsMaintenance.svelte.js";

  const ui = createSettingsMaintenance();
</script>

<section id="section-maintenance" class="settings-section settings-section-last">
  <h2 class="section-title">系統維護</h2>
  <p class="section-desc">提供資料完整性檢查與維護工具，確保檔案系統與資料庫之間的一致性。</p>

  <!-- 孤立檔案 -->
  <div class="tool-card">
    <div class="tool-header">
      <IconFileSearch size={18} />
      <h3 class="tool-title">孤立檔案檢查</h3>
    </div>
    <p class="tool-desc">
      掃描 <code>committed/</code> 目錄，找出實際存在但不在資料庫中的檔案。這類檔案通常因資料庫曾被手動修改或損壞而產生。檢查後可選擇刪除這些檔案以釋放空間。
    </p>
    <div class="tool-actions">
      <button class="btn btn-sm" onclick={ui.handleOrphanCheckClick} disabled={ui.orphanBusy}>
        {ui.orphanBusy ? "檢查中…" : "開始檢查"}
      </button>
      {#if ui.orphanList.length > 0}
        <button class="btn btn-sm btn-destructive" onclick={ui.handleOrphanDeleteClick} disabled={ui.orphanBusy}>
          刪除 {ui.orphanList.length} 個孤立檔案
        </button>
      {/if}
    </div>
    {#if ui.orphanResult}
      <p class="tool-result">{ui.orphanResult}</p>
    {/if}
    {#if ui.orphanList.length > 0}
      <ul class="tool-file-list">
        {#each ui.orphanList as file}
          <li>{file}</li>
        {/each}
      </ul>
    {/if}
  </div>

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
      <button class="btn btn-sm" onclick={ui.handleMissingCheckClick} disabled={ui.missingBusy}>
        {ui.missingBusy ? "檢查中…" : "開始檢查"}
      </button>
      {#if ui.missingList.length > 0}
        <button class="btn btn-sm btn-destructive" onclick={ui.handleMissingDeleteClick} disabled={ui.missingBusy}>
          刪除 {ui.missingList.length} 個缺失記錄
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

  <!-- 資料庫備份 -->
  <div class="tool-card">
    <div class="tool-header">
      <IconDatabase size={18} />
      <h3 class="tool-title">資料庫備份</h3>
    </div>
    <p class="tool-desc">
      將目前的 <code>db.json</code> 建立一份時間戳記的備份副本。備份檔會存放在圖片集根目錄下，命名格式為
      <code>db.backup.{"{"}<i>timestamp</i>{"}"}.json</code>。建議在進行批量操作或維護前先建立備份。
    </p>
    <div class="tool-actions">
      <button class="btn btn-sm" onclick={ui.handleBackupClick} disabled={ui.backupBusy}>
        {ui.backupBusy ? "備份中…" : "建立備份"}
      </button>
    </div>
    {#if ui.backupResult}
      <p class="tool-result">{ui.backupResult}</p>
    {/if}
  </div>

  <!-- 清空垃圾桶 -->
  <div class="tool-card">
    <div class="tool-header">
      <IconTrashX size={18} />
      <h3 class="tool-title">清空垃圾桶</h3>
    </div>
    <p class="tool-desc">
      永久刪除垃圾桶中的所有檔案。此操作不可復原，被刪除的檔案將無法恢復。若不確定是否要永久刪除，可先前往垃圾桶頁面逐一確認。
    </p>
    <div class="tool-actions">
      <button class="btn btn-sm btn-destructive" onclick={ui.handleEmptyTrashClick} disabled={ui.trashBusy}>
        {ui.trashBusy ? "清空中…" : "清空垃圾桶"}
      </button>
    </div>
    {#if ui.trashResult}
      <p class="tool-result">{ui.trashResult}</p>
    {/if}
  </div>
</section>

<style>
  .settings-section {
    padding-bottom: 2.5rem;
    margin-bottom: 2.5rem;
    border-bottom: 1px solid var(--border);
  }

  .settings-section-last {
    border-bottom: none;
    margin-bottom: 0;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin-bottom: 0.5rem;
  }

  .section-desc {
    color: var(--text-muted);
    font-size: 0.875rem;
    line-height: 1.7;
    margin-bottom: 1.25rem;
  }

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

  .tool-desc code {
    font-family: var(--font-mono);
    background: var(--bg-active);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-size: 0.75rem;
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
