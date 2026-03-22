<script lang="ts">
  import { page } from "$app/state";
  import Alert from "$lib/components/Alert.svelte";
  import { SettingsCollection } from "./settingsCollection.svelte.js";

  type Props = { collectionRoot: string };
  let { collectionRoot }: Props = $props();

  const ui = new SettingsCollection({
    get collectionRoot() {
      return collectionRoot;
    },
  });

  const alert = $derived(page.url.searchParams.get("alert"));
</script>

<ul>
  <li><code>images/</code> — 所有圖片存放於此。</li>
</ul>

{#if alert === "default"}
  <div class="alert">
    <Alert type="default" message="尚未設定圖片集路徑，請在下方設定後繼續。" />
  </div>
{:else if alert === "error"}
  <div class="alert">
    <Alert type="error" message="設定的路徑無效或無法存取，請重新設定。" />
  </div>
{/if}

<form onsubmit={ui.handleFormSubmit}>
  <label for="collection-root">圖片集根目錄</label>
  <input
    id="collection-root"
    type="text"
    class="text-input"
    bind:value={ui.inputValue}
    placeholder="例如 C:/Users/you/Pictures/tagged"
  />

  {#if ui.message}
    <p class:error={ui.isError}>
      {ui.message}
    </p>
  {/if}

  <button type="submit" class="btn btn-primary" disabled={ui.saving}>
    {ui.saving ? "儲存中…" : "儲存"}
  </button>
</form>

<style>
  ul {
    color: var(--text-muted);
    font-size: 0.8125rem;
    line-height: 1.8;
    margin-bottom: 1.5rem;
    padding-left: 1.25rem;

    & code {
      font-family: var(--font-mono);
      background: var(--bg-active);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      font-size: 0.75rem;
    }
  }

  .alert {
    margin-bottom: 1.25rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    & > label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text);
    }

    & > p {
      font-size: 0.8125rem;
      color: var(--color-success);
    }

    & > p.error {
      color: var(--destructive);
    }
  }
</style>
