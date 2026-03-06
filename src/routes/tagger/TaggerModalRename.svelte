<script lang="ts">
  import Autocomplete from "$lib/components/Autocomplete.svelte";
  import { toolStore } from "./stores.svelte.js";
  import { closeRenameModal, renameTag } from "./actions.js";

  // ── Local form state ──────────────────────────────────────
  let selectedTags = $state<string[]>([]);
  let oldName = $derived.by(() => selectedTags[0] ?? "");
  let newName = $state("");
  let newInputEl: HTMLInputElement | undefined = $state();

  // Reset fields whenever the modal opens
  $effect(() => {
    if (toolStore.showRename) {
      selectedTags = [];
      newName = "";
    }
  });

  function handleSelectChange() {
    if (selectedTags.length > 1) selectedTags = [selectedTags.at(-1)!];
    if (oldName) requestAnimationFrame(() => newInputEl?.focus());
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
            <Autocomplete
              bind:tags={selectedTags}
              variant="inline"
              placeholder="選擇要重命名的標籤..."
              onchange={handleSelectChange}
            />
          </div>
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
</style>
