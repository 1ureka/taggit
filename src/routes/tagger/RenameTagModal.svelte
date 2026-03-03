<script lang="ts">
  import TagAutocomplete from "$lib/components/TagAutocomplete.svelte";
  import { toolStore, tagCatalogStore } from "./stores.svelte.js";
  import { closeRenameModal, renameTag } from "./actions.js";

  // ── Local form state ──────────────────────────────────────
  let oldName = $state("");
  let newName = $state("");
  let newInputEl: HTMLInputElement | undefined = $state();

  // Reset fields whenever the modal opens
  $effect(() => {
    if (toolStore.showRename) {
      oldName = "";
      newName = "";
    }
  });

  function handleSelectOld(tag: string) {
    oldName = tag.trim().toLowerCase();
    requestAnimationFrame(() => newInputEl?.focus());
  }

  function handleSubmit() {
    const trimOld = oldName.trim().toLowerCase();
    const trimNew = newName.trim().toLowerCase();
    if (!trimOld || !trimNew || trimOld === trimNew) return;
    renameTag(trimOld, trimNew);
    closeRenameModal();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") closeRenameModal();
  }
</script>

<svelte:window onkeydown={toolStore.showRename ? handleKeydown : undefined} />

{#if toolStore.showRename}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay"
    onclick={(e) => {
      if (e.target === e.currentTarget) closeRenameModal();
    }}
  >
    <div class="modal scale-in" style="max-width:28rem">
      <div class="modal-title">標籤重命名</div>
      <div class="modal-body">
        <div class="rename-field">
          <label class="rename-label" for="rename-old">舊標籤名稱</label>
          <div class="rename-ac-wrap">
            <TagAutocomplete
              allTags={tagCatalogStore.known}
              placeholder="選擇要重命名的標籤..."
              onselect={handleSelectOld}
            />
          </div>
          {#if oldName}
            <div class="rename-selected">
              已選擇：<span class="chip">{oldName}</span>
            </div>
          {/if}
        </div>

        <div class="rename-field">
          <label class="rename-label" for="rename-new">新標籤名稱</label>
          <input
            bind:this={newInputEl}
            bind:value={newName}
            id="rename-new"
            class="input"
            placeholder="輸入新的標籤名稱..."
            autocomplete="off"
            onkeydown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn" onclick={closeRenameModal}>取消</button>
        <button
          class="btn btn-primary"
          onclick={handleSubmit}
          disabled={!oldName.trim() || !newName.trim() || oldName.trim() === newName.trim()}
        >
          重命名
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .rename-field {
    margin-bottom: 1rem;
  }

  .rename-field:last-child {
    margin-bottom: 0;
  }

  .rename-label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-muted);
    margin-bottom: 0.375rem;
  }

  .rename-ac-wrap {
    position: relative;
  }

  .rename-selected {
    margin-top: 0.375rem;
    font-size: 0.8125rem;
    color: var(--text-dim);
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
</style>
