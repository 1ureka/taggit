<script lang="ts">
  import Autocomplete from "$lib/components/Autocomplete.svelte";
  import { SettingsTagRename } from "./settingsTagRename.svelte.js";

  const ui = new SettingsTagRename();
</script>

<div class="field">
  <span class="label">舊標籤名稱</span>
  <Autocomplete
    bind:tags={ui.selectedTags}
    variant="inline"
    placeholder="選擇要重命名的標籤..."
    onchange={ui.handleSelectChange}
  />
</div>

<div class="field">
  <label class="label" for="rename-new">新標籤名稱</label>
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
  <p class="result" class:error={ui.resultIsError}>
    {ui.result}
  </p>
{/if}

<style>
  .label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text);
    margin-bottom: 0.375rem;
  }

  .field {
    margin-bottom: 0.75rem;
  }

  /* .rename-ac-wrap {
    position: relative;
  } */

  .result {
    margin-top: 0.75rem;
    font-size: 0.8125rem;
    color: var(--color-success);
  }

  .result.error {
    color: var(--destructive);
  }
</style>
