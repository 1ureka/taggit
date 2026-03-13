<script lang="ts">
  import Autocomplete from "$lib/components/Autocomplete.svelte";
  import { SettingsTagRename } from "./settingsTagRename.svelte.js";

  const ui = new SettingsTagRename();
</script>

<section id="section-tags" class="settings-section">
  <h2 class="section-title">標籤管理</h2>

  <div class="section-block">
    <h3 class="block-title">標籤重命名</h3>
    <p class="section-desc">
      將某個標籤全域重命名為另一個名稱。此操作會遍歷所有已提交的圖片，將含有舊標籤的圖片一律改為新標籤。若某張圖片已同時擁有新舊兩個標籤，重命名後舊標籤會直接移除，不會產生重複。
    </p>

    <div class="rename-field">
      <span class="section-label">舊標籤名稱</span>
      <div class="rename-ac-wrap">
        <Autocomplete
          bind:tags={ui.selectedTags}
          variant="inline"
          placeholder="選擇要重命名的標籤..."
          onchange={ui.handleSelectChange}
        />
      </div>
    </div>

    <div class="rename-field">
      <label class="section-label" for="rename-new">新標籤名稱</label>
      <input
        bind:this={ui.newInputEl}
        bind:value={ui.newName}
        id="rename-new"
        class="text-input"
        placeholder="輸入新的標籤名稱..."
        autocomplete="off"
        onkeydown={ui.handleNewNameKeydown}
      />
    </div>

    <button class="btn btn-primary" onclick={ui.handleRenameClick} disabled={!ui.canSubmit}>
      {ui.busy ? "重命名中…" : "重命名"}
    </button>

    {#if ui.result}
      <p class="section-result" class:error={ui.resultIsError}>
        {ui.result}
      </p>
    {/if}
  </div>
</section>

<style>
  .settings-section {
    padding-bottom: 2.5rem;
    margin-bottom: 2.5rem;
    border-bottom: 1px solid var(--border);
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin-bottom: 0.5rem;
  }

  .section-block {
    margin-top: 0.5rem;
  }

  .block-title {
    font-size: 0.9375rem;
    font-weight: 500;
    margin-bottom: 0.375rem;
  }

  .section-desc {
    color: var(--text-muted);
    font-size: 0.875rem;
    line-height: 1.7;
    margin-bottom: 1.25rem;
  }

  .section-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text);
    margin-bottom: 0.375rem;
  }

  .rename-field {
    margin-bottom: 0.75rem;
  }

  .rename-ac-wrap {
    position: relative;
  }

  .section-result {
    margin-top: 0.75rem;
    font-size: 0.8125rem;
    color: var(--color-success);
  }

  .section-result.error {
    color: var(--destructive);
  }
</style>
